import { ErrorCodes } from '@core/constants/error-codes';
import TeamCluster, {
    TeamClusterProps,
    TeamClusterStatus,
    TeamClusterRole
} from '@modules/team-cluster/domain/entities/TeamCluster';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

type TeamClusterRelations = 'team' | 'createdBy';

export interface TeamClusterDocument extends Persistable<TeamClusterProps, TeamClusterRelations>, Document {}

const TEAM_CLUSTER_VALIDATION_ERROR = ErrorCodes.VALIDATION_INVALID_INPUT;

const serviceCredentialsSchema = new Schema({
    port: {
        type: Number,
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR],
        max: [65535, TEAM_CLUSTER_VALIDATION_ERROR],
        default: null
    },
    username: {
        type: String,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        select: false
    },
    password: {
        type: String,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        select: false
    }
}, {
    _id: false
});

const daemonCredentialsSchema = new Schema({
    port: {
        type: Number,
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR],
        max: [65535, TEAM_CLUSTER_VALIDATION_ERROR],
        default: null
    },
    password: {
        type: String,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        select: false
    }
}, {
    _id: false
});

const TeamClusterSchema = new Schema({
    name: {
        type: String,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        minlength: [2, TEAM_CLUSTER_VALIDATION_ERROR],
        maxlength: [64, TEAM_CLUSTER_VALIDATION_ERROR],
        trim: true
    },
    role: {
        type: String,
        enum: Object.values(TeamClusterRole),
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        default: TeamClusterRole.Cluster
    },
    team: {
        ...teamRefField([true, TEAM_CLUSTER_VALIDATION_ERROR]),
        index: true
    },
    createdBy: {
        ...userRefField([true, TEAM_CLUSTER_VALIDATION_ERROR]),
        index: true
    },
    status: {
        type: String,
        enum: Object.values(TeamClusterStatus),
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        default: TeamClusterStatus.WaitingForConnection
    },
    enrollmentTokenHash: {
        type: String,
        default: null,
        select: false
    },
    installedVersion: {
        type: String,
        default: null
    },
    installRoot: {
        type: String,
        default: null
    },
    lastHeartbeatAt: {
        type: Date,
        default: null
    },
    lastDisconnectAt: {
        type: Date,
        default: null
    },
    services: {
        minio: {
            type: serviceCredentialsSchema,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
        },
        redis: {
            type: serviceCredentialsSchema,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
        },
        mongodb: {
            type: serviceCredentialsSchema,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
        },
        daemon: {
            type: daemonCredentialsSchema,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
        }
    }
}, {
    timestamps: true
});

TeamClusterSchema.index({ team: 1, name: 1 }, { unique: true });
TeamClusterSchema.index({ team: 1, role: 1 });

const TeamClusterModel: Model<TeamClusterDocument> = mongoose.model<TeamClusterDocument>('TeamCluster', TeamClusterSchema);

export default TeamClusterModel;
