import {
    isPopulatedSecretKeyRole,
    type PopulatedRole,
    type PopulatedUser,
    type SecretKeyProps
} from '@shared/contracts/types/SecretKey';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Document, Model } from 'mongoose';

export { isPopulatedSecretKeyRole };
export type { PopulatedRole, PopulatedUser, SecretKeyProps };

export const getSecretKeyRoleId = (secretKey: Pick<SecretKeyProps, 'role'>): string => {
    if (isPopulatedSecretKeyRole(secretKey.role)) {
        return secretKey.role._id;
    }

    return String(secretKey.role);
};

export const getSecretKeyRoleName = (secretKey: Pick<SecretKeyProps, 'role'>): string => {
    if (isPopulatedSecretKeyRole(secretKey.role)) {
        return secretKey.role.name;
    }

    return 'Unknown';
};

export const getSecretKeyCreatedById = (secretKey: Pick<SecretKeyProps, 'createdBy'>): string => {
    const { createdBy } = secretKey;
    if (typeof createdBy === 'string') {
        return createdBy;
    }
    if (createdBy instanceof mongoose.Types.ObjectId) {
        return createdBy.toString();
    }

    return createdBy._id;
};

type SecretKeyRelations = 'team' | 'role' | 'createdBy';

export interface SecretKeyDocument extends Persistable<SecretKeyProps, SecretKeyRelations>, Document {};

const SecretKeySchema: Schema<SecretKeyDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    role: {
        type: Schema.Types.ObjectId,
        ref: 'TeamRole',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    keyPrefix: {
        type: String,
        required: true
    },
    keyHash: {
        type: String,
        required: true,
        unique: true,
        select: false
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsedAt: {
        type: Date
    }
}, {
    timestamps: true
});

SecretKeySchema.index({
    team: 1,
    isActive: 1,
    createdAt: -1
});

SecretKeySchema.index({ team: 1, role: 1 });

SecretKeySchema.index({ team: 1, keyPrefix: 1 });

const SecretKeyModel: Model<SecretKeyDocument> = mongoose.model<SecretKeyDocument>('SecretKey', SecretKeySchema);

export default SecretKeyModel;
