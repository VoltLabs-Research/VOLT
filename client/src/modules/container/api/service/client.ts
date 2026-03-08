import type { CreateContainerParams } from '../dtos/create-container';

const client = {
    default: {
        basePath: '/containers',
        useRBAC: true
    },
    scoped: {
        basePath: '/containers',
        useRBAC: true,
        getTeamId: (params: CreateContainerParams) => params.teamId
    }
};

export default client;
