import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface ActiveSession extends BaseEntity {
    user: string;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    action: SessionActivityType;
    success: boolean;
    failureReason?: string;
};

export interface LoginActivityEntry extends BaseEntity {
    user: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    action: SessionActivityType;
    success: boolean;
    failureReason?: string;
};

export enum SessionActivityType {
    Login = 'login',
    Logout = 'logout',
    FailedLogin = 'failed_login',
    OAuthLogin = 'oauth_login',
    PasswordUpdate = 'password_update'
};
