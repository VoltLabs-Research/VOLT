import type { CreateContainerParams } from '../dtos/create-container';

const clients = {
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

export default clients;