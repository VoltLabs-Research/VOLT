import { ErrorCodes } from '@core/constants/error-codes';
import {
    TeamClusterProps,
    TeamClusterRole,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
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

const queueConcurrencySchema = new Schema({
    analysis: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    rasterizer: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    glbPreprocessing: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    artifactUpload: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    sshImport: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const queueScopeLimitSchema = new Schema({
    maxRunningPerTrajectory: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [0, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    maxRunningPerTeam: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [0, TEAM_CLUSTER_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const queueScopeLimitsSchema = new Schema({
    analysisProcessing: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    artifactUpload: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    trajectoryRasterization: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    trajectoryGlbConversion: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    cloudUpload: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    trajectoryCompression: {
        type: queueScopeLimitSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const teamClusterRoleSchema = new Schema({
    desiredRole: {
        type: String,
        enum: ['cluster', 'storage-server', 'compute-node'] satisfies TeamClusterRole[],
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        default: 'cluster'
    },
    effectiveRole: {
        type: String,
        enum: ['cluster', 'storage-server', 'compute-node'] satisfies TeamClusterRole[],
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        default: 'cluster'
    },
    runtimeVersion: {
        type: Number,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        min: [1, TEAM_CLUSTER_VALIDATION_ERROR],
        default: 1
    },
    draining: {
        compute: {
            type: Boolean,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
            default: false
        },
        storage: {
            type: Boolean,
            required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
            default: false
        }
    },
    lastAppliedAt: {
        type: Date,
        default: null
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
    },
    queueConcurrency: {
        type: queueConcurrencySchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    queueScopeLimits: {
        type: queueScopeLimitsSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    roleConfig: {
        type: teamClusterRoleSchema,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR]
    },
    isDemo: {
        type: Boolean,
        required: [true, TEAM_CLUSTER_VALIDATION_ERROR],
        default: false
    },
    demoExpiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

TeamClusterSchema.index({ team: 1, name: 1 }, { unique: true });
TeamClusterSchema.index({ team: 1, status: 1, createdAt: -1 });
TeamClusterSchema.index({ status: 1, lastHeartbeatAt: 1 });
TeamClusterSchema.index({ status: 1, updatedAt: 1 });
TeamClusterSchema.index(
    { team: 1, isDemo: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isDemo: true,
            status: { $nin: [TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed] }
        }
    }
);
TeamClusterSchema.index({ isDemo: 1, demoExpiresAt: 1 });

const TeamClusterModel: Model<TeamClusterDocument> = mongoose.model<TeamClusterDocument>('TeamCluster', TeamClusterSchema);

export default TeamClusterModel;
