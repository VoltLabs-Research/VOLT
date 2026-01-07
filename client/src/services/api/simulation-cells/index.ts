import VoltClient from '@/api';

const resource = 'simulation-cells';
// @ts-ignore
const client = new VoltClient(`/${resource}`, { useRBAC: true });

const simulationCellApi = {
    getAll: (teamId: string, params: any) =>
        client.request('get', '/', {
            query: { ...params, team: teamId }
        }),

    getOne: (id: string, teamId: string) =>
        client.request('get', `/${id}`, {
            query: { team: teamId }
        })
};

export default simulationCellApi;
