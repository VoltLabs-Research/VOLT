import type { CreateContainerPortProxySessionParams } from '../../dtos/create-container-port-proxy-session';
import type { ContainerPortProxySession } from '../../entities/container-port-proxy-session';
import { post } from '@/app/core/http/utilities/create-service';

const endpoints = {
    createPortProxySession: post<CreateContainerPortProxySessionParams, ContainerPortProxySession>('/:containerId/ports/:privatePort/session', {
        client: 'scoped',
        omit: ['teamId'],
        body: () => ({})
    })
};

export default endpoints;
