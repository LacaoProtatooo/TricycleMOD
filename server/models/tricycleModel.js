import mongoose from "mongoose";

const tricycleSchema = new mongoose.Schema({
    plateNumber: {
        type: String,
        required: [true, 'Plate number is required'],
        trim: true,
        uppercase: true,
        match: [/^[0-9]{3}[A-Z]{3}$/, 'Plate number must be 3 numbers followed by 3 letters (e.g., 123ABC)'],
        maxlength: [6, 'Plate number must be exactly 6 characters'],
        minlength: [6, 'Plate number must be exactly 6 characters']
    },
    bodyNumber: {
        type: String,
        trim: true,
        // Validation only applies if value is provided (not empty)
        validate: {
            validator: function(v) {
                // Allow empty/null values, only validate if there's a value
                if (!v || v === '') return true;
                return /^[0-9]{4}$/.test(v); // Exactly 4 digits
            },
            message: 'Body number must be exactly 4 digits (e.g., 0001, 1234)'
        }
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
    // Certificate of Registration (CR) Fields
    crData: {
        mvFileNumber: { type: String, trim: true },
        chassisNumber: { type: String, trim: true },
        engineNumber: { type: String, trim: true },
        vehicleMake: { type: String, trim: true },
        vehicleSeries: { type: String, trim: true },
        yearModel: { type: String, trim: true },
        bodyType: { type: String, trim: true },
        color: { type: String, trim: true },
        fuelType: { type: String, trim: true },
        dateOfInitialRegistration: { type: Date },
        registrationExpiryDate: { type: Date },
        ltoOfficeCode: { type: String, trim: true },
        classification: { type: String, enum: ['Private', 'For Hire', ''], default: '' },
        denomination: { type: String, trim: true },
        registeredOwnerName: { type: String, trim: true },
        ownerAddress: { type: String, trim: true },
        crImage: {
            public_id: { type: String },
            url: { type: String }
        }
    },
    // Official Receipt (OR) Fields
    orData: {
        orNumber: { type: String, trim: true },
        orDate: { type: Date },
        amountPaid: { type: Number },
        paymentType: { type: String, trim: true },
        ltoCollectionOffice: { type: String, trim: true },
        validityCoverageYear: { type: String, trim: true },
        orImage: {
            public_id: { type: String },
            url: { type: String }
        }
    },
    // Document validation status
    documentValidation: {
        isValidated: { type: Boolean, default: false },
        validationErrors: [{ type: String }],
        validatedAt: { type: Date },
        plateNumberMatch: { type: Boolean },
        mvFileMatch: { type: Boolean },
        orDateWithinValidity: { type: Boolean },
        ownerNameConsistent: { type: Boolean },
        classificationValid: { type: Boolean }
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
    // Boundary/Koding (rental fee) agreement
    boundary: {
        amount: { type: Number, min: 0, max: 1000, default: 0 }, // Amount in PHP (300-700 typical)
        settlementType: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
        lastSettledAt: { type: Date },
        notes: { type: String, trim: true, maxlength: 200 }
    },
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
