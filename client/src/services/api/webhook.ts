import api from '@/api';

interface Webhook {
    _id: string;
    url: string;
    events: string[];
    active: boolean;
    [key: string]: any;
}

interface CreateWebhookPayload {
    url: string;
    events: string[];
    secret?: string;
}

const webhookApi = {
    async create(data: CreateWebhookPayload): Promise<Webhook>{
        const response = await api.post<{ status: string; data: Webhook }>('/webhooks', data);
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await api.delete(`/webhooks/${id}`);
    },

    async test(id: string): Promise<void>{
        await api.post(`/webhooks/${id}/test`);
    }
};

export default webhookApi;
