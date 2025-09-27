import { useState, useEffect } from 'react';
import { api } from '@/services/api';

export interface Webhook {
    _id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    lastTriggered?: string;
    failureCount: number;
    status: 'active' | 'inactive' | 'failed';
    createdAt: string;
    updatedAt: string;
}

export interface WebhookStats {
    totalWebhooks: number;
    activeWebhooks: number;
    failedWebhooks: number;
    lastTriggered?: string;
}

export interface CreateWebhookData {
    name: string;
    url: string;
    events: string[];
}

export interface UpdateWebhookData {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
}

export const useWebhooks = () => {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [stats, setStats] = useState<WebhookStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWebhooks = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/webhooks');
            setWebhooks(response.data.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch webhooks');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/webhooks/stats');
            setStats(response.data.data);
        } catch (err: any) {
            console.error('Failed to fetch webhook stats:', err);
        }
    };

    const createWebhook = async (webhookData: CreateWebhookData): Promise<Webhook> => {
        try {
            const response = await api.post('/webhooks', webhookData);
            await fetchWebhooks();
            await fetchStats();
            return response.data.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to create webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const updateWebhook = async (id: string, webhookData: UpdateWebhookData): Promise<Webhook> => {
        try {
            const response = await api.patch(`/webhooks/${id}`, webhookData);
            await fetchWebhooks();
            await fetchStats();
            return response.data.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to update webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const deleteWebhook = async (id: string): Promise<void> => {
        try {
            await api.delete(`/webhooks/${id}`);
            await fetchWebhooks();
            await fetchStats();
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to delete webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const testWebhook = async (id: string): Promise<void> => {
        try {
            await api.post(`/webhooks/${id}/test`);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to test webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    useEffect(() => {
        fetchWebhooks();
        fetchStats();
    }, []);

    return {
        webhooks,
        stats,
        loading,
        error,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        testWebhook,
        refetch: fetchWebhooks
    };
};

export default useWebhooks;
