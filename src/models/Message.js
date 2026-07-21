import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image'], default: 'text' },
    text: { type: String, trim: true, maxlength: 4000, default: '' },
    // Image binary is kept out of normal queries (`select: false`) — it is only
    // streamed by the dedicated image endpoint, never in the message list/socket.
    imageData: { type: Buffer, select: false },
    image: {
      contentType: { type: String },
      size: { type: Number },
      name: { type: String },
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
