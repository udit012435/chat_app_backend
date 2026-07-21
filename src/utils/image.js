import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Bring an oversized image under 10 MB without ever failing:
// 1) re-encode as progressive JPEG, dropping quality step by step,
// 2) if still too big, downscale the dimensions.
// Returns the compressed buffer + its new content type.
export const compressUnderLimit = async (buffer) => {
  const base = sharp(buffer, { failOn: 'none' }).rotate(); // rotate() honours EXIF orientation
  const meta = await base.metadata();

  let quality = 80;
  let out = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality, progressive: true }).toBuffer();

  while (out.length > MAX_IMAGE_BYTES && quality > 30) {
    quality -= 15;
    out = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality, progressive: true }).toBuffer();
  }

  let width = meta.width || 2000;
  while (out.length > MAX_IMAGE_BYTES && width > 640) {
    width = Math.round(width * 0.8);
    out = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width })
      .jpeg({ quality: 60, progressive: true })
      .toBuffer();
  }

  return { data: out, contentType: 'image/jpeg' };
};

// Square-crop + shrink an uploaded photo into a small avatar, returned as a
// base64 data URL so it can be stored on the user and used directly in <img src>.
export const makeAvatarDataUrl = async (buffer) => {
  const out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
};

// Shrink an uploaded photo into a chat wallpaper. Wider than an avatar but still
// small enough to live on the user document as a base64 data URL.
export const makeWallpaperDataUrl = async (buffer) => {
  const out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
};
