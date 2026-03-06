import { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export enum SessionActivityType {
    Login = 'login',
    Logout = 'logout',
    FailedLogin = 'failed_login',
    OAuthLogin = 'oauth_login',
    PasswordUpdate = 'password_update'
}

export interface Session extends BaseEntity {
    user: string;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    action: SessionActivityType;
    success: boolean;
    failureReason?: string;
}

export interface LoginActivity {
    activites: Session[];
    total: number;
}

export interface RevokeAllResult {
    revokedCount: number;
}
