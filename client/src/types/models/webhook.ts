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

export const WEBHOOK_EVENTS = [
    'trajectory.created',
    'trajectory.updated',
    'trajectory.deleted',
    'analysis.completed',
    'analysis.failed',
    'user.login',
    'user.logout'
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];
