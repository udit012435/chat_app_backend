import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

inviteSchema.index({ from: 1, to: 1 }, { unique: true });

export const Invite = mongoose.model('Invite', inviteSchema);
