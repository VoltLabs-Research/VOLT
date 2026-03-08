import { get } from '@/app/core/http/utilities/create-service';
import type { ListSSHFilesParams, ListSSHFilesResponse } from '../../dtos/list-ssh-files';

const endpoints = {
    listFiles: get<ListSSHFilesParams, ListSSHFilesResponse>('/:connectionId/files', {
        query: ({ path }) => path ? { path } : undefined
    })
};

export default endpoints;
