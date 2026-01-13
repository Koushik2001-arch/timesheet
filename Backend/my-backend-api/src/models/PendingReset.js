import mongoose from 'mongoose';

const pendingResetSchema = new mongoose.Schema({
  empId: String,
  email: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  token: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Auto-delete after 24 hours
  },
});

const PendingReset = mongoose.model('PendingReset', pendingResetSchema);
export default PendingReset;
