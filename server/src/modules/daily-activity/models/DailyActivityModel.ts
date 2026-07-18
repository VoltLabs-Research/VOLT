import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

export enum ActivityType {
    TrajectoryUpload = 'trajectory-upload',
    TrajectoryDeletion = 'trajectory-deletion',
    AnalysisPerformed = 'analysis-performed',
    AnalysisDeletion = 'analysis-deletion',
    LatexDocumentCreation = 'latex-document-creation',
    LatexDocumentDeletion = 'latex-document-deletion',
    ContainerCreation = 'container-creation',
    ContainerDeletion = 'container-deletion',
    WhiteboardCreation = 'whiteboard-creation',
    WhiteboardDeletion = 'whiteboard-deletion',
    RoleCreation = 'role-creation',
    RoleDeletion = 'role-deletion',
    SecretKeyCreation = 'secret-key-creation',
    SecretKeyDeletion = 'secret-key-deletion'
}

export interface IDailyActivityEntry {
    type: ActivityType;
    createdAt: Date;
    description: string;
}

export interface IDailyActivity extends Document {
    team: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    date: Date;
    activity: IDailyActivityEntry[];
    minutesOnline: number;
    createdAt: Date;
    updatedAt: Date;
}

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

const DailyActivitySchema: Schema<IDailyActivity> = new Schema({
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

const DailyActivityModel: Model<IDailyActivity> = mongoose.model<IDailyActivity>('DailyActivity', DailyActivitySchema);

export default DailyActivityModel;
