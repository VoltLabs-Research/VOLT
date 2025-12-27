import mongoose, { Schema, Model, Document } from 'mongoose';

export enum TeamActivityType {
    TRAJECTORY_UPLOAD = 'TRAJECTORY_UPLOAD',
    TRAJECTORY_DELETION = 'TRAJECTORY_DELETION',
    ANALYSIS_PERFORMED = 'ANALYSIS_PERFORMED'
}

export interface ITeamActivity {
    type: TeamActivityType;
    user: mongoose.Types.ObjectId;
    createdAt: Date;
    description: string;
}

export interface IDailyActivity extends Document {
    team: mongoose.Types.ObjectId;
    user?: mongoose.Types.ObjectId;
    date: Date;
    activity: ITeamActivity[];
    minutesOnline: number;
}

const TeamActivitySchema = new Schema({
    type: {
        type: String,
        enum: Object.values(TeamActivityType),
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
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

const DailyActivitySchema: Schema<IDailyActivity> = new Schema({
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
        type: [TeamActivitySchema],
        default: []
    },
    minutesOnline: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Ensure only one record per team per user per day
DailyActivitySchema.index({ team: 1, user: 1, date: 1 }, { unique: true });

const DailyActivity: Model<IDailyActivity> = mongoose.model<IDailyActivity>('DailyActivity', DailyActivitySchema);

export default DailyActivity;
