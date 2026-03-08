import { get } from '@/app/core/http/utilities/create-service';
import type { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '../../dtos/get-container-files';
import type { ReadContainerFileInputDTO, ReadContainerFileOutputDTO } from '../../dtos/read-container-file';

const endpoints = {
    getFiles: get<GetContainerFilesInputDTO, GetContainerFilesOutputDTO>('/:containerId/files', {
        query: ({ path }) => {
            let query: { path: string } | undefined;
            if (path) {
                query = { path };
            }
            return query;
        }
    }),
    readFile: get<ReadContainerFileInputDTO, ReadContainerFileOutputDTO>('/:containerId/files/content', {
        query: ({ path }) => ({ path })
    })
};

export default endpoints;
