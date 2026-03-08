import { get } from '@/app/core/http/utilities/create-service';
import type { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '../../dtos/get-container-files';
import type { ReadContainerFileInputDTO, ReadContainerFileOutputDTO } from '../../dtos/read-container-file';

const endpoints = {
    getFiles: get<GetContainerFilesInputDTO, GetContainerFilesOutputDTO>('/:containerId/files', {
        query: ({ path }) => path ? { path } : undefined
    }),
    readFile: get<ReadContainerFileInputDTO, ReadContainerFileOutputDTO>('/:containerId/file', {
        query: ({ path }) => ({ path })
    })
};

export default endpoints;