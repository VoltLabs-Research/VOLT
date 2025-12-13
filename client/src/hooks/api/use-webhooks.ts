import { useState, useEffect } from 'react';
import webhookApi from '@/services/api/webhook';

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
    text: string;
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

    const fetchWebhooks = async() => {
        try{
            setLoading(true);
            setError(null);
            const data = await webhookApi.getAll?.() as any || [];
            setWebhooks(data);
        }catch(err: any){
            console.error('Failed to fetch webhooks');
            setError(err.response?.data?.message || 'Failed to fetch webhooks');
        }finally{
            setLoading(false);
        }
    };

    const fetchStats = async() => {
        try{
            const data = await webhookApi.getStats?.() as any || null;
            setStats(data);
        }catch(err: any){
            console.error('Failed to fetch webhook stats:', err);
        }
    };

    const createWebhook = async(webhookData: CreateWebhookData): Promise<Webhook> =>{
        try{
            const result = await webhookApi.create({ url: webhookData.url, events: webhookData.events });
            await fetchWebhooks();
            await fetchStats();
            return result as Webhook;
        }catch(err: any){
            console.error('Failed to create webhook');
            const errorMessage = err.response?.data?.message || 'Failed to create webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const updateWebhook = async(id: string, webhookData: UpdateWebhookData): Promise<Webhook> =>{
        try{
            const result = await webhookApi.update?.(id, webhookData) as any;
            await fetchWebhooks();
            await fetchStats();
            return result;
        }catch(err: any){
            console.error('Failed to update webhook');
            const errorMessage = err.response?.data?.message || 'Failed to update webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const deleteWebhook = async(id: string): Promise<void> =>{
        try{
            await webhookApi.delete(id);
            await fetchWebhooks();
            await fetchStats();
        }catch(err: any){
            console.error('Failed to delete webhook');
            const errorMessage = err.response?.data?.message || 'Failed to delete webhook';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    };

    const testWebhook = async(id: string): Promise<void> =>{
        try{
            await webhookApi.test(id);
        }catch(err: any){
            console.error('Failed to test webhook');
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
