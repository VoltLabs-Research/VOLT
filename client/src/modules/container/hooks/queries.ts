import type { Container } from '../api/entities/container';
import type { CreateContainerParams } from '../api/dtos/create-container';
import type { UpdateContainerFields } from '../api/dtos/update-container';
import type { GetContainersParams } from '../api/dtos/get-containers';
import type { GetContainerFilesInputDTO } from '../api/dtos/get-container-files';
import type { ReadContainerFileInputDTO } from '../api/dtos/read-container-file';
import { createQuery, createPaginatedQuery, buildKeys } from '@/shared/infrastructure/query/create-paginated-query';
import service from '../api/service';

const BASE_KEY = 'container';
const KEYS = buildKeys<{
    detail: string,
    files: GetContainerFilesInputDTO,
    fileContent: ReadContainerFileInputDTO;
    processes: string;
    stats: string;
}>(BASE_KEY);

export const containerQuery = createPaginatedQuery<Container, GetContainersParams, CreateContainerParams, UpdateContainerFields>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: (params) => service.getAll(params),
        create: (params) => service.create(params),
        update: (id, params) => service.update({ containerId: id, ...params }) as Promise<Container>,
        delete: (id) => service.delete({ containerId: id })
    }
});

export const useContainerFilesQuery = createQuery(KEYS.files, service.getFiles);
export const useContainerFileContentQuery = createQuery(KEYS.fileContent, service.readFile);

export const useContainerByIdQuery = createQuery(KEYS.detail, (containerId) => service.getById({ containerId }));
export const useContainerProcessesQuery = createQuery(KEYS.processes, (containerId) => service.getProcesses({ containerId }));
export const useContainerStatsQuery = createQuery(KEYS.stats, (containerId) => service.getStats({ containerId }));
