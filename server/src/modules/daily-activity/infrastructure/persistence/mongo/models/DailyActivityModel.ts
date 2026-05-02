import { ActivityType } from '@modules/daily-activity/domain/entities/DailyActivity';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { DailyActivityProps } from '@modules/daily-activity/domain/entities/DailyActivity';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum DailyActivityRelation {
    Team = 'team',
    User = 'user'
}

export interface DailyActivityDocument extends Persistable<
    DailyActivityProps,
    DailyActivityRelation.Team | DailyActivityRelation.User
>, Document {};

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
        ...teamRefField(true),
        index: true
    },
    user: {
        ...userRefField(false),
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
    {
        team: 1,
        user: 1,
        date: 1
    },
    { unique: true }
);

const DailyActivityModel: Model<DailyActivityDocument> = mongoose.model<DailyActivityDocument>('DailyActivity', DailyActivitySchema);

export default DailyActivityModel;
