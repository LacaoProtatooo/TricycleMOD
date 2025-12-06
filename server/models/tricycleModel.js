import mongoose from "mongoose";

const tricycleSchema = new mongoose.Schema({
    plateNumber: {
        type: String,
        required: [true, 'Plate number is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Plate number cannot exceed 20 characters']
    },
    model: {
        type: String,
        required: [true, 'Model is required'],
        trim: true,
        maxlength: [30, 'Model cannot exceed 30 characters']
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Operator is required']
    },
    status: {
        type: String,
        enum: ['available', 'unavailable'],
        default: 'unavailable'
    },
    currentOdometer: {
        type: Number,
        default: 0
    },
    maintenanceHistory: [
        {
            itemKey: { type: String, required: true },
            lastServiceKm: { type: Number, required: true },
            completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            completedAt: { type: Date, default: Date.now },
            notes: String
        }
    ],
    schedules: [
        {
            driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            startTime: { type: String }, // e.g., "08:00"
            endTime: { type: String },   // e.g., "17:00"
            days: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }]
        }
    ],
    images: [
        {
            public_id: {
                type: String,
                required: true
            },
            url: {
                type: String,
                required: true
            },
        }
    ],
    // Other fields: Engine, Chassis, Color, etc. can be added here || para sa maintenance records
}, { timestamps: true });

const Tricycle = mongoose.model('Tricycle', tricycleSchema);

export default Tricycle;
