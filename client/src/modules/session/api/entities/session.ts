import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface ActiveSession extends BaseEntity {
    user: string;
    ip: string;
    lastActivity: string;
    isCurrent: boolean;
    browser: string;
    os: string;
    isMobile: boolean;
};

export interface LoginActivityEntry extends BaseEntity {
    user: string;
    userAgent: string;
    ip: string;
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
