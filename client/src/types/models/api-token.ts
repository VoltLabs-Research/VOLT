export interface ApiToken {
    _id: string;
    name: string;
    description?: string;
    token?: string;
    maskedToken: string;
    permissions: string[];
    expiresAt?: string;
    lastUsedAt?: string;
    isActive: boolean;
    status: 'active' | 'inactive' | 'expired';
    createdAt: string;
    updatedAt: string;
}

export interface ApiTokenStats {
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    lastUsed?: string;
}

export interface CreateTokenData {
    name: string;
    description?: string;
    permissions: string[];
    expiresAt?: string;
}

export interface UpdateTokenData {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
}

export const API_TOKEN_PERMISSIONS = [
    'read:trajectories',
    'write:trajectories',
    'delete:trajectories',
    'read:analysis',
    'write:analysis',
    'delete:analysis',
    'read:teams',
    'write:teams',
    'admin:all'
] as const;

export type ApiTokenPermission = typeof API_TOKEN_PERMISSIONS[number];
