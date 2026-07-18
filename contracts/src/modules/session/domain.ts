

export interface PersistedSession{
    _id: string;
    user: string | null;
    token: null;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    action: string;
    success: boolean;
    createdAt: string;
    updatedAt: string;
    isCurrent: boolean;
    browser: string;
    os: string;
    isMobile: boolean;
}

export interface GetLoginActivityResponse{
    activities: PersistedSession[];
}

export interface RevokeAllSessionsResponse{
    revokedCount: number;
}
