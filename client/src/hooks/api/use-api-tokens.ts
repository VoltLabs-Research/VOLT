import { useState, useEffect } from 'react';
import { api } from '@/api';

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

export const useApiTokens = () => {
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [stats, setStats] = useState<ApiTokenStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTokens = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/api-tokens');
            setTokens(response.data.data);
        } catch (err: any) {
            console.error('❌ Failed to fetch API tokens:', err);
            setError(err.response?.data?.message || 'Failed to fetch API tokens');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/api-tokens/stats');
            setStats(response.data.data);
        } catch (err: any) {
            console.error('Failed to fetch API token stats:', err);
        }
    };

    const createToken = async (tokenData: CreateTokenData): Promise<ApiToken> => {
        try {
            const response = await api.post('/api-tokens', tokenData);
            await fetchTokens();
            await fetchStats();
            return response.data.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to create API token';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const updateToken = async (id: string, tokenData: UpdateTokenData): Promise<ApiToken> => {
        try {
            const response = await api.patch(`/api-tokens/${id}`, tokenData);
            await fetchTokens();
            await fetchStats();
            return response.data.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to update API token';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const deleteToken = async (id: string): Promise<void> => {
        try {
            await api.delete(`/api-tokens/${id}`);
            await fetchTokens();
            await fetchStats();
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to delete API token';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const regenerateToken = async (id: string): Promise<ApiToken> => {
        try {
            const response = await api.post(`/api-tokens/${id}/regenerate`);
            await fetchTokens();
            await fetchStats();
            return response.data.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to regenerate API token';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    useEffect(() => {
        fetchTokens();
        fetchStats();
    }, []);

    return {
        tokens,
        stats,
        loading,
        error,
        createToken,
        updateToken,
        deleteToken,
        regenerateToken,
        refetch: fetchTokens
    };
};

export default useApiTokens;
