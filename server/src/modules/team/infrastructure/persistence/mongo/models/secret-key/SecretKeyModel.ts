import { SecretKeyProps } from '@modules/team/domain/entities/secret-key/SecretKey';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Document, Model } from 'mongoose';

enum SecretKeyRelation {
    Team = 'team',
    Role = 'role',
    CreatedBy = 'createdBy'
};

type SecretKeyRelations = `${SecretKeyRelation}`;

export interface SecretKeyDocument extends Persistable<SecretKeyProps, SecretKeyRelations>, Document {};

const SecretKeySchema: Schema<SecretKeyDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        cascade: 'delete'
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
