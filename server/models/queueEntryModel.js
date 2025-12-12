import mongoose from 'mongoose';

const queueEntrySchema = new mongoose.Schema({
  tricycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Tricycle', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bodyNumber: { type: String, required: true, uppercase: true, trim: true },
  terminal: { type: String, default: 'default', trim: true },
  status: { type: String, enum: ['waiting', 'called', 'done', 'cancelled'], default: 'waiting' },
}, { timestamps: true });

queueEntrySchema.index({ tricycle: 1, status: 1, createdAt: 1 });
queueEntrySchema.index({ driver: 1, status: 1 });
queueEntrySchema.index({ bodyNumber: 1, status: 1 });

const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);
export default QueueEntry;
