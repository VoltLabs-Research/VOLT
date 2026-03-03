export enum SessionActivityType {
    Login = 'login',
    Logout = 'logout',
    FailedLogin = 'failed_login',
    OAuthLogin = 'oauth_login',
    PasswordUpdate = 'password_update'
}

export interface Session {
    _id: string;
    user: string;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    action: SessionActivityType;
    success: boolean;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoginActivity {
    activites: Session[];
    total: number;
}

export interface RevokeAllResult {
    revokedCount: number;
}
