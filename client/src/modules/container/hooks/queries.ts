import service from '../api/service';
import { createQuery, createPaginatedQuery, buildKeys } from '@/shared/infrastructure/query/create-paginated-query';
import type { CreateContainerParams } from '../api/dtos/create-container';
import type { GetContainerFilesInputDTO } from '../api/dtos/get-container-files';
import type { GetContainersParams } from '../api/dtos/get-containers';
import type { ReadContainerFileInputDTO } from '../api/dtos/read-container-file';
import type { UpdateContainerFields } from '../api/dtos/update-container';
import type { Container } from '../api/entities/container';

const BASE_KEY = 'container';

interface ContainerQueryKeys extends Record<string, unknown> {
    detail: string;
    files: GetContainerFilesInputDTO;
    fileContent: ReadContainerFileInputDTO;
    processes: string;
    stats: string;
};

const KEYS = buildKeys<ContainerQueryKeys>(BASE_KEY);

export const containerQuery = createPaginatedQuery<Container, GetContainersParams, CreateContainerParams, UpdateContainerFields>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        create: service.create,
        update: (id, params) => service.update({ containerId: id, ...params }),
        delete: (id) => service.delete({ containerId: id })
    }
});

export const useContainerFilesQuery = createQuery(KEYS.files, service.getFiles);
export const useContainerFileContentQuery = createQuery(KEYS.fileContent, service.readFile);

export const useContainerByIdQuery = createQuery(KEYS.detail, (containerId) => service.getById({ containerId }));
export const useContainerProcessesQuery = createQuery(KEYS.processes, (containerId) => service.getProcesses({ containerId }));
export const useContainerStatsQuery = createQuery(KEYS.stats, (containerId) => service.getStats({ containerId }));
