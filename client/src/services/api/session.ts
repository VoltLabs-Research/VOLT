import VoltClient from '@/api';

const client = new VoltClient('/session');

export interface Session {
    _id: string;
    user: string;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: string;
    createdAt: string;
    updatedAt: string;
}

interface LoginActivity {
    timestamp: string;
    success: boolean;
    ip: string;
    device: string;
    [key: string]: any;
}

interface GetLoginActivityParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
}

const sessionApi = {
    async getAll(): Promise<Session[]> {
        // BaseController.getAll returns paginated response
        const response = await client.request<{ status: string; data: Session[] }>('get', '/');
        return response.data.data;
    },

    async revoke(id: string): Promise<void> {
        // Use updateOne with isActive: false instead of delete
        await client.request('patch', `/${id}`, { data: { isActive: false } });
    },

    async revokeOthers(): Promise<void> {
        await client.request('delete', '/all/others');
    },

    async getLoginActivity(params?: GetLoginActivityParams): Promise<LoginActivity[]> {
        const queryString = params
            ? `?${new URLSearchParams(params as any).toString()}`
            : '';

        const response = await client.request<{ status: string; data: LoginActivity[] }>('get', `/activity${queryString}`);
        return response.data.data;
    }
};

export default sessionApi;
