import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { ContainerRouteParams } from '../../dtos/container-route-params';
import type { Container } from '../../entities/container';
import type { GetContainersParams } from '../../dtos/get-containers';
import type { CreateContainerParams } from '../../dtos/create-container';
import type { UpdateContainerParams } from '../../dtos/update-container';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const normalizePorts = (ports: CreateContainerParams['ports']) => ports?.map(({ public: publicPort, ...port }) => (
    publicPort === 0
        ? port
        : {
            ...port,
            public: publicPort
        }
));

const endpoints = {
    getAll: paginated<GetContainersParams, PaginatedResponse<Container>>('/'),
    getById: get<ContainerRouteParams, Container>('/:containerId', {
        unwrap: { field: 'container' }
    }),
    create: post<CreateContainerParams, Container>('/', {
        client: 'scoped',
        omit: ['teamId'],
        body: ({ teamClusterId, folderId, name, image, memory, cpus, env, ports, cmd, mountDockerSocket, useImageCmd, capabilities }) => ({
            teamClusterId,
            folderId,
            name,
            image,
            memory,
            cpus,
            env,
            ports: normalizePorts(ports),
            cmd,
            mountDockerSocket,
            useImageCmd,
            capabilities
        }),
        unwrap: { field: 'container' }
    }),
    update: patch<UpdateContainerParams, Container>('/:containerId', {
        body: ({ action, env, ports }) => ({
            action,
            env,
            ports: normalizePorts(ports)
        }),
        unwrap: { field: 'container' }
    }),
    delete: del<ContainerRouteParams>('/:containerId'),
    move: patch<{ containerId: string; folderId: string | null }, void>('/:containerId/folder', {
        body: ({ folderId }) => ({ folderId })
    })
};

export default endpoints;
