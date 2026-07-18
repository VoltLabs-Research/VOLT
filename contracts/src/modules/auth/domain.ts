export type OAuthProviderId = 'github' | 'microsoft' | 'google';

export type UserRoleId = 'admin' | 'user';

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

export type Account = PersistedUser & { fullName: string };

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
