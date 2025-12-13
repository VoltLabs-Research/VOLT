import api from '@/api';

interface ApiToken {
    _id: string;
    name: string;
    token?: string;
    maskedToken?: string;
    lastUsed?: string;
    lastUsedAt?: string;
    expiresAt?: string;
    isActive?: boolean;
    status?: 'active' | 'inactive' | 'expired';
    permissions?: string[];
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

interface ApiTokenStats {
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    lastUsed?: string;
}

interface CreateApiTokenPayload {
    name: string;
    expiresIn?: number;
    scopes?: string[];
    description?: string;
    permissions?: string[];
}

interface UpdateApiTokenPayload {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
}

const apiTokenApi = {
    async getAll(): Promise<ApiToken[]> {
        const response = await api.get<{ status: string; data: ApiToken[] }>('/api-tokens');
        return response.data.data;
    },

    async getStats(): Promise<ApiTokenStats> {
        const response = await api.get<{ status: string; data: ApiTokenStats }>('/api-tokens/stats');
        return response.data.data;
    },

    async create(data: CreateApiTokenPayload): Promise<ApiToken> {
        const response = await api.post<{ status: string; data: ApiToken }>('/api-tokens', data);
        return response.data.data;
    },

    async update(id: string, data: UpdateApiTokenPayload): Promise<ApiToken> {
        const response = await api.patch<{ status: string; data: ApiToken }>(`/api-tokens/${id}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/api-tokens/${id}`);
    },

    async regenerate(id: string): Promise<ApiToken> {
        const response = await api.post<{ status: string; data: ApiToken }>(`/api-tokens/${id}/regenerate`);
        return response.data.data;
    }
};

export default apiTokenApi;
