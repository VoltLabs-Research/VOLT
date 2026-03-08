import mongoose, { Schema, Model, Document } from 'mongoose';
import { ErrorCodes } from '@core/constants/error-codes';
import { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

type SSHConnectionRelations = 'team' | 'user';

export interface SSHConnectionDocument extends Persistable<SSHConnectionProps, SSHConnectionRelations>, Document{}

const SSH_CONNECTION_VALIDATION_ERROR = ErrorCodes.VALIDATION_INVALID_INPUT;

const SSHConnectionSchema = new Schema({
    name: {
        type: String,
        required: [true, SSH_CONNECTION_VALIDATION_ERROR],
        minlength: [2, SSH_CONNECTION_VALIDATION_ERROR],
        maxlength: [64, SSH_CONNECTION_VALIDATION_ERROR],
        trim: true
    },
    team: {
        ...teamRefField([true, SSH_CONNECTION_VALIDATION_ERROR]),
        index: true
    },
    host: {
        type: String,
        required: [true, SSH_CONNECTION_VALIDATION_ERROR],
        trim: true,
        validate: {
            validator: function (value: string) {
                const isHostname = /^[a-zA-Z0-9.-]+$/.test(value);
                const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);

                if (isHostname || isIPv4) {
                    return true;
                }

                return false;
            },
            message: SSH_CONNECTION_VALIDATION_ERROR
        }
    },
    port: {
        type: Number,
        required: [true, SSH_CONNECTION_VALIDATION_ERROR],
        min: [1, SSH_CONNECTION_VALIDATION_ERROR],
        max: [65535, SSH_CONNECTION_VALIDATION_ERROR],
        default: 22
    },
    username: {
        type: String,
        required: [true, SSH_CONNECTION_VALIDATION_ERROR],
        trim: true,
        minlength: [1, SSH_CONNECTION_VALIDATION_ERROR],
        maxlength: [64, SSH_CONNECTION_VALIDATION_ERROR]
    },
    encryptedPassword: {
        type: String,
        required: [true, SSH_CONNECTION_VALIDATION_ERROR],
        select: false
    },
    user: {
        ...userRefField([true, SSH_CONNECTION_VALIDATION_ERROR]),
        index: true
    }
}, {
    timestamps: true
});

SSHConnectionSchema.index({ team: 1, name: 1 }, { unique: true });

const SSHConnectionModel: Model<SSHConnectionDocument> = mongoose.model<SSHConnectionDocument>('SSHConnection', SSHConnectionSchema);

export default SSHConnectionModel;
