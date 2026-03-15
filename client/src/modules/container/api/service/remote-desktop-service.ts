import { post } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { CreateContainerRemoteDesktopSessionParams } from '../dtos/create-container-remote-desktop-session';
import type { ContainerRemoteDesktopSession } from '../entities/container-remote-desktop-session';

const clients = {
    scoped: {
        basePath: '/container-vnc',
        useRBAC: true,
        getTeamId: (params: CreateContainerRemoteDesktopSessionParams) => params.teamId
    }
};

const endpoints = {
    createSession: post<CreateContainerRemoteDesktopSessionParams, ContainerRemoteDesktopSession>('/:containerId/session', {
        client: 'scoped',
        omit: ['teamId'],
        unwrap: { field: 'session' }
    })
};

const remoteDesktopService = defineServiceModule({
    clients,
    endpoints
});

export default remoteDesktopService;
