import VoltClient from '@/api';

const client = new VoltClient('/system');

interface SystemStats {
    cpu: {
        usage: number;
        cores: number;
    };
    memory: {
        total: number;
        used: number;
        free: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
    };
    [key: string]: any;
}

const systemApi = {
    async getStats(): Promise<SystemStats>{
        const response = await client.request<{ status: string; data: { stats: SystemStats } }>('get', '/stats');
        return response.data.data.stats;
    }
};

export default systemApi;
