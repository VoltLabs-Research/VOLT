import VoltClient from '@/api';

const resource = 'simulation-cell';
// @ts-ignore
const client = new VoltClient(`/${resource}`, { useRBAC: true });

const simulationCellApi = {
    async getAll(teamId: string, params: any): Promise<any> {
        const response = await client.request<{ status: string; data: any }>('get', '/', { query: params });
        return response.data.data;
    },

    async getOne(id: string, teamId: string): Promise<any> {
        const response = await client.request<{ status: string; data: any }>('get', `/${id}`, {
            query: { team: teamId }
        });
        return response.data.data;
    }
};

export default simulationCellApi;
