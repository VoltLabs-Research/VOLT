export type OAuthProviderId = 'github' | 'microsoft' | 'google';

export type UserRoleId = 'admin' | 'user';

/** A user as the client sees it: `_id`/dates as strings, never the password. */
export interface PersistedUser{
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRoleId;
    avatar?: string;
    teams: string[];
    analyses: string[];
    lastLoginAt: string;
    lastSeenAt?: string | null;
    passwordChangedAt?: string;
    oauthProvider?: OAuthProviderId;
    oauthId?: string;
    createdAt: string;
    updatedAt: string;
}

/** `GET /me` adds a derived `fullName` on top of the persisted user. */
export type Account = PersistedUser & { fullName: string };

/** Response of every credentialed auth entry point (sign in / sign up / local / password change). */
export interface AuthSession{
    token: string;
    user: PersistedUser;
}

export interface GuestIdentity{
    firstName: string;
    lastName: string;
    avatar: string;
}

export interface PasswordInfo{
    hasPassword: boolean;
    lastChanged?: string;
}

export interface CheckEmailResponse{
    exists: boolean;
}

export interface OAuthProviders{
    providers: OAuthProviderId[];
}

export interface DeleteAccountResponse{
    success: boolean;
}
