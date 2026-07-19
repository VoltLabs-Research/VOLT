import { ErrorCodes } from '@core/constants/error-codes';
import { OAuthProvider } from '@modules/auth/domain/OAuthProvider';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import validator from 'validator';

export enum UserRole {
    Admin = 'admin',
    User = 'user'
}

export interface SplitFullNameResult {
    firstName: string;
    lastName?: string;
}

export const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

export const normalizeName = (name: string): string => {
    return name.trim().toLowerCase();
};

export const splitFullName = (fullName: string): SplitFullNameResult => {
    const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
    const [firstName, ...lastNameParts] = normalizedFullName.split(' ');

    const splitName: SplitFullNameResult = {
        firstName: normalizeName(firstName)
    };

    if (lastNameParts.length > 0) {
        splitName.lastName = normalizeName(lastNameParts.join(' '));
    }

    return splitName;
};

export interface UserMethods {
    isPasswordChangedAfterTokenIssued(jwtTimestamp: number): boolean;
}

export interface UserDocument extends Document, UserMethods {
    _id: Types.ObjectId;
    email: string;
    lastLoginAt: Date;
    lastSeenAt?: Date | null;
    role?: UserRole;
    passwordChangedAt?: Date;
    teams: Types.ObjectId[];
    analyses: Types.ObjectId[];
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
    avatar?: string;
    password?: string;
    oauthProvider?: OAuthProvider;
    oauthId?: string;
}

interface OAuthProviderPartialFilterExpression {
    $type: 'string';
}

interface UserOAuthPartialFilterExpression {
    oauthProvider: OAuthProviderPartialFilterExpression;
}

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

UserSchema.methods.isPasswordChangedAfterTokenIssued = function (jwtTimestamp: number): boolean {
    if (this.passwordChangedAt) {
        const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return jwtTimestamp < changedTimestamp;
    }

    return false;
};

const User: Model<UserDocument> = mongoose.model<UserDocument>('User', UserSchema);

export default User;
