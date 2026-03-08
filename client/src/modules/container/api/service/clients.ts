import type { CreateContainerParams } from '../dtos/create-container';

const clients = {
    default: {
        basePath: '/container',
        useRBAC: true
    },
    scoped: {
        basePath: '/container',
        useRBAC: true,
        getTeamId: (params: CreateContainerParams) => params.teamId
    }
};

export default clients;