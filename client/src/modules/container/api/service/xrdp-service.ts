import { post } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { CreateContainerXrdpSessionParams } from '../dtos/create-container-xrdp-session';
import type { ContainerXrdpSession } from '../entities/container-xrdp-session';

const clients = {
    scoped: {
        basePath: '/container-xrdp',
        useRBAC: true,
        getTeamId: (params: CreateContainerXrdpSessionParams) => params.teamId
    }
};

const endpoints = {
    createSession: post<CreateContainerXrdpSessionParams, ContainerXrdpSession>('/:containerId/session', {
        client: 'scoped',
        omit: ['teamId'],
        unwrap: { field: 'session' }
    })
};

const xrdpService = defineServiceModule({
    clients,
    endpoints
});

export default xrdpService;
