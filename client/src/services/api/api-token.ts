import api from '@/api';

interface ApiToken {
    _id: string;
    name: string;
    token?: string;
    lastUsed?: string;
    expiresAt?: string;
    [key: string]: any;
}

interface CreateApiTokenPayload {
    name: string;
    expiresIn?: number;
    scopes?: string[];
}

const apiTokenApi = {
    async create(data: CreateApiTokenPayload): Promise<ApiToken> {
        const response = await api.post<{ status: string; data: ApiToken }>('/api-tokens', data);
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
