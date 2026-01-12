import mongoose, { Schema, Model, Document } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { SSHConnectionProps } from '@/src/modules/ssh/domain/entities/SSHConnection';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type SSHConnectionRelations = 'team' | 'user';

export interface SSHConnectionDocument extends Persistable<SSHConnectionProps, SSHConnectionRelations>, Document{}

const SSHConnectionSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.SSH_CONNECTION_NAME_REQUIRED],
        minlength: [2, ValidationCodes.SSH_CONNECTION_MINLEN],
        maxlength: [64, ValidationCodes.SSH_CONNECTION_MAXLEN],
        trim: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.SSH_CONNECTION_TEAM],
        index: true
    },
    host: {
        type: String,
        required: [true, ValidationCodes.SSH_CONNECTION_HOST],
        trim: true,
        validate: {
            validator: function (v: string) {
                // Basic validation for hostname or IP
                return /^[a-zA-Z0-9.-]+$/.test(v) || /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
            },
            message: ValidationCodes.SSH_CONNECTION_HOST_INVALID
        }
    },
    port: {
        type: Number,
        required: [true, ValidationCodes.SSH_CONNECTION_PORT_REQUIRED],
        min: [1, ValidationCodes.SSH_CONNECTION_PORT_MIN],
        max: [65535, ValidationCodes.SSH_CONNECTION_PORT_MAX],
        default: 22
    },
    username: {
        type: String,
        required: [true, ValidationCodes.SSH_CONNECTION_USERNAME_REQUIRED],
        trim: true,
        minlength: [1, ValidationCodes.SSH_CONNECTION_USERNAME_MINLEN],
        maxlength: [64, ValidationCodes.SSH_CONNECTION_USERNAME_MAXLEN]
    },
    encryptedPassword: {
        type: String,
        required: [true, ValidationCodes.SSH_CONNECTION_ENCRYPTED_PASSWORD],
        select: false
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.SSH_CONNECTION_USER],
        index: true
    }
}, {
    timestamps: true
});

SSHConnectionSchema.index({ user: 1, name: 1 }, { unique: true });

const SSHConnectionModel: Model<SSHConnectionDocument> = mongoose.model<SSHConnectionDocument>('SSHConnection', SSHConnectionSchema);

export default SSHConnectionModel;