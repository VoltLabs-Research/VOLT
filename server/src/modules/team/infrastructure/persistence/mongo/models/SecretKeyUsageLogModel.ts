import mongoose, { Schema, Document, Model } from 'mongoose';
import { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

const USAGE_LOG_TTL_SECONDS = 90 * 24 * 60 * 60;

type SecretKeyUsageLogRelations = 'secretKey' | 'team';

export interface SecretKeyUsageLogDocument extends Persistable<SecretKeyUsageLogProps, SecretKeyUsageLogRelations>, Document {}

const SecretKeyUsageLogSchema: Schema<SecretKeyUsageLogDocument> = new Schema({
    secretKey: {
        type: Schema.Types.ObjectId,
        ref: 'SecretKey',
        required: true
    },
    team: {
        ...teamRefField(true),
        cascade: 'delete'
    },
    method: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    responseTime: {
        type: Number,
        required: true
    },
    ip: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

SecretKeyUsageLogSchema.index({ team: 1, createdAt: -1 });
SecretKeyUsageLogSchema.index({ secretKey: 1, createdAt: -1 });
SecretKeyUsageLogSchema.index({ team: 1, secretKey: 1, createdAt: -1 });
SecretKeyUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: USAGE_LOG_TTL_SECONDS });

const SecretKeyUsageLogModel: Model<SecretKeyUsageLogDocument> = mongoose.model<SecretKeyUsageLogDocument>('SecretKeyUsageLog', SecretKeyUsageLogSchema);

export default SecretKeyUsageLogModel;
