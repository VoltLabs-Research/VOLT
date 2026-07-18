// Wire response types for the session module — the shapes the client reads back
// from `data`. `_id`, refs and dates are strings on the wire; `token` is always
// nulled out before it leaves the server.

/** A session as the client sees it (token redacted, user-agent parsed). */
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
