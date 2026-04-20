import { ErrorCodes } from '@core/constants/error-codes';
import { OAuthProvider, UserRole } from '@modules/auth/domain/entities/User';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';
import validator from 'validator';
import type { UserProps } from '@modules/auth/domain/entities/User';

export interface UserDocument extends UserProps, Document {
    _id: Types.ObjectId;
};

interface OAuthProviderPartialFilterExpression {
    $type: 'string';
};

interface UserOAuthPartialFilterExpression {
    oauthProvider: OAuthProviderPartialFilterExpression;
};

const userOAuthPartialFilterExpression: UserOAuthPartialFilterExpression = {
    oauthProvider: {
        $type: 'string'
    }
};

const UserSchema: Schema<UserDocument> = new Schema({
    email: {
        type: String,
        required: [true, ErrorCodes.VALIDATION_INVALID_INPUT],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, ErrorCodes.VALIDATION_INVALID_INPUT]
    },
    password: {
        type: String,
        required: function (this: UserDocument) {
            return !this.oauthProvider;
        },
        minlength: [8, ErrorCodes.VALIDATION_INVALID_INPUT],
        select: false
    },
    role: {
        type: String,
        lowercase: true,
        enum: Object.values(UserRole),
        default: 'user'
    },
    passwordChangedAt: Date,
    lastLoginAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastSeenAt: {
        type: Date,
        default: Date.now
    },
    firstName: {
        type: String,
        minlength: [1, ErrorCodes.VALIDATION_INVALID_INPUT],
        maxlength: [64, ErrorCodes.VALIDATION_INVALID_INPUT],
        required: [true, ErrorCodes.VALIDATION_INVALID_INPUT],
        lowercase: true,
        trim: true
    },
    lastName: {
        type: String,
        maxlength: [64, ErrorCodes.VALIDATION_INVALID_INPUT],
        default: '',
        lowercase: true,
        trim: true
    },
    teams: [{
        type: Schema.Types.ObjectId,
        ref: 'Team'
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
    partialFilterExpression: userOAuthPartialFilterExpression
});

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', UserSchema);

export default User;
