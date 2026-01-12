import mongoose, { Schema, Model, Document } from 'mongoose';
import { ActivityType, DailyActivityProps } from '@/src/modules/daily-activity/domain/entities/DailyActivity';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type DailyActivityRelations = 'team' | 'user';
export interface DailyActivityDocument extends Persistable<DailyActivityProps, DailyActivityRelations>, Document{}

const ActivitySchema = new Schema({
    type: {
        type: String,
        enum: Object.values(ActivityType),
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    description: {
        type: String,
        required: true
    }
}, { _id: false });

const DailyActivitySchema: Schema<DailyActivityDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    date: {
        type: Date,
        required: true
    },
    activity: {
        type: [ActivitySchema],
        default: []
    },
    minutesOnline: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

DailyActivitySchema.index(
    { team: 1, user: 1, date: 1 },
    { unique: true }
);

const DailyActivityModel: Model<DailyActivityDocument> = mongoose.model<DailyActivityDocument>('DailyActivity', DailyActivitySchema);

export default DailyActivityModel;