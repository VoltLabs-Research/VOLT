import type { BaseEntity } from '../../shared/base';

export type OAuthProviderId = 'github' | 'microsoft' | 'google';

export type UserRoleId = 'admin' | 'user';

export interface User extends BaseEntity{
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    avatar?: string;
    role?: UserRoleId;
    teams?: string[];
    analyses?: string[];
    lastLoginAt?: string;
    lastSeenAt?: string | null;
    isOnline?: boolean;
    passwordChangedAt?: string;
    oauthProvider?: OAuthProviderId;
    oauthId?: string;
}

export type Account = User & { fullName: string };

export interface AuthSession{
    token: string;
    user: User;
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
