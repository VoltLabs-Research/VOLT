import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { ContainerRouteParams } from '../../dtos/container-route-params';
import type { Container } from '../../entities/container';
import type { GetContainersParams } from '../../dtos/get-containers';
import type { CreateContainerParams } from '../../dtos/create-container';
import type { UpdateContainerParams } from '../../dtos/update-container';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const endpoints = {
    getAll: paginated<GetContainersParams, PaginatedResponse<Container>>('/'),
    getById: get<ContainerRouteParams, Container>('/:containerId', {
        unwrap: { field: 'container' }
    }),
    create: post<CreateContainerParams, Container>('/', {
        client: 'scoped',
        omit: ['teamId'],
        unwrap: { field: 'container' }
    }),
    update: patch<UpdateContainerParams, Container>('/:containerId', {
        unwrap: { field: 'container' }
    }),
    delete: del<ContainerRouteParams>('/:containerId')
};

export default endpoints;
