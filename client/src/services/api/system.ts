import api from '@/api';

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
    async getStats(): Promise<SystemStats> {
        const response = await api.get<{ status: string; data: { stats: SystemStats } }>('/system/stats');
        return response.data.data.stats;
    }
};

export default systemApi;
