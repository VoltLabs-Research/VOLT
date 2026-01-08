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
    timestamp: string;
    success: boolean;
    ip: string;
    device: string;
    [key: string]: any;
}

export interface GetLoginActivityParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}