export interface Session {
    _id: string;
    user: string;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoginActivity {
    _id?: string;
    user?: string;
    action?: 'login' | 'logout' | 'failed_login';
    ip?: string;
    userAgent?: string;
    success: boolean;
    failureReason?: string;
    createdAt?: string;
    timestamp?: string;
    device?: string;
    [key: string]: any;
}

export interface GetLoginActivityParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}
