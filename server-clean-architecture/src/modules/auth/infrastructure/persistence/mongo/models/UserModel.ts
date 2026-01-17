import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import validator from 'validator';
import { ValidationCodes } from '../../../../../../core/constants/validation-codes';
import { UserProps, OAuthProvider, UserRole } from '../../../../domain/entities/User';

export interface UserDocument extends Omit<UserProps, 'id'>, Document {
    _id: Types.ObjectId;
}

const UserSchema: Schema<UserDocument> = new Schema({
    email: {
        type: String,
        required: [true, ValidationCodes.USER_EMAIL_REQUIRED],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, ValidationCodes.USER_EMAIL_INVALID]
    },
    password: {
        type: String,
        required: function (this: UserDocument) {
            return !this.oauthProvider;
        },
        minlength: [8, ValidationCodes.USER_PASSWORD_MINLEN],
        select: false
    },
    role: {
        type: String,
        lowercase: true,
        enum: Object.values(UserRole),
        default: 'user'
    },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    firstName: {
        type: String,
        minlength: [4, ValidationCodes.USER_FIRST_NAME_MINLEN],
        maxlength: [64, ValidationCodes.USER_FIRST_NAME_MAXLEN],
        required: [true, ValidationCodes.USER_FIRST_NAME_REQUIRED],
        lowercase: true,
        trim: true
    },
    lastName: {
        type: String,
        minlength: [4, ValidationCodes.USER_LAST_NAME_MINLEN],
        maxlength: [64, ValidationCodes.USER_LAST_NAME_MAXLEN],
        required: [true, ValidationCodes.USER_LAST_NAME_REQUIRED],
        lowercase: true,
        trim: true
    },
    teams: [{
        type: Schema.Types.ObjectId,
        ref: 'Team',
        cascade: 'pull'
    }],
    analyses: [{
        type: Schema.Types.ObjectId,
        ref: 'Analysis'
    }],
    // OAuth fields
    oauthProvider: {
        type: String,
        enum: Object.values(OAuthProvider),
        default: null
    },
    oauthId: {
        type: String,
        sparse: true
    },
    avatar: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

UserSchema.index({ email: 'text' });
UserSchema.index({ oauthProvider: 1, oauthId: 1 }, {
    unique: true,
    partialFilterExpression: {
        oauthProvider: { $type: 'string' }
    }
});

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', UserSchema);

export default User;
