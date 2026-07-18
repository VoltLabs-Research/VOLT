import { ValidationCodes } from '@core/constants/validation-codes';
import mongoose, { Schema, Model, Document } from 'mongoose';

export enum EarlyAccessSubscriptionSource {
    DiscoverTeam = 'discover_team'
}

export interface IEarlyAccessSubscription extends Document {
    team: mongoose.Types.ObjectId;
    email: string;
    source: EarlyAccessSubscriptionSource;
    referrer?: string;
    lastSubmittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const EarlyAccessSubscriptionSchema: Schema<IEarlyAccessSubscription> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.EARLY_ACCESS_SUBSCRIPTION_TEAM_REQUIRED],
        index: true
    },
    email: {
        type: String,
        required: [true, ValidationCodes.EARLY_ACCESS_SUBSCRIPTION_EMAIL_REQUIRED],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, ValidationCodes.EARLY_ACCESS_SUBSCRIPTION_EMAIL_INVALID],
        index: true
    },
    source: {
        type: String,
        enum: {
            values: Object.values(EarlyAccessSubscriptionSource),
            message: ValidationCodes.EARLY_ACCESS_SUBSCRIPTION_SOURCE_INVALID
        },
        default: EarlyAccessSubscriptionSource.DiscoverTeam,
        required: true
    },
    referrer: {
        type: String,
        trim: true,
        maxlength: 2048
    },
    lastSubmittedAt: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: true
});

EarlyAccessSubscriptionSchema.index({ team: 1, email: 1 }, { unique: true });
EarlyAccessSubscriptionSchema.index({ source: 1, createdAt: -1 });

const EarlyAccessSubscriptionModel: Model<IEarlyAccessSubscription> = mongoose.model<IEarlyAccessSubscription>(
    'EarlyAccessSubscription',
    EarlyAccessSubscriptionSchema
);

export default EarlyAccessSubscriptionModel;
