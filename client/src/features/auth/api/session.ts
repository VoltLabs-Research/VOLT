import VoltClient from '@/api';
import type { Session, GetLoginActivityParams, LoginActivity } from '@/features/auth/types/session';
import type { ApiResponse } from '@/types/api';

const client = new VoltClient('/sessions');

const sessionApi = {
    async getAll(): Promise<Session[]> {
        const response = await client.request<ApiResponse<Session[]>>('get', '/');
        return response.data.data;
    },

    async revoke(id: string): Promise<void> {
        await client.request('patch', `/${id}`, { data: { isActive: false } });
    },

    async revokeOthers(): Promise<void> {
        await client.request('delete', '/all/others');
    },

    async getLoginActivity(params?: GetLoginActivityParams): Promise<LoginActivity[]> {
        const queryString = params
            ? `?${new URLSearchParams(params as any).toString()}`
            : '';

        const response = await client.request<ApiResponse<LoginActivity[]>>('get', `/activity${queryString}`);
        return response.data.data;
    }
};

export default sessionApi;
