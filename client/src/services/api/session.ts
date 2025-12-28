import VoltClient from '@/api';

const client = new VoltClient('/session');

interface Session {
    _id: string;
    device: string;
    browser: string;
    os: string;
    ip: string;
    lastActive: string;
    current: boolean;
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
    async getAll(): Promise<Session[]>{
        const response = await client.request<{ status: string; data: Session[] }>('get', '/');
        return response.data.data;
    },

    async delete(id: string): Promise<void>{
        await client.request('delete', `/${id}`);
    },

    async deleteOthers(): Promise<void>{
        await client.request('delete', '/all/others');
    },

    async getLoginActivity(params?: GetLoginActivityParams): Promise<LoginActivity[]>{
        const queryString = params
            ? `?${new URLSearchParams(params as any).toString()}`
            : '';

        const response = await client.request<{ status: string; data: LoginActivity[] }>('get', `/activity${queryString}`);
        return response.data.data;
    }
};

export default sessionApi;
