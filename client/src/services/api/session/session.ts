import VoltClient from '@/api';
import type { Session, GetLoginActivityParams, LoginActivity } from './types';

const client = new VoltClient('/session');

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
