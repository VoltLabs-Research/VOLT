import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateContainerFolderParams } from '../../dtos/create-container-folder';
import type { DeleteContainerFolderParams } from '../../dtos/delete-container-folder';
import type { GetContainerFolderParams } from '../../dtos/get-container-folder';
import type { ListContainerFoldersParams } from '../../dtos/list-container-folders';
import type { UpdateContainerFolderParams } from '../../dtos/update-container-folder';
import type { ContainerFolder } from '../../entities/container-folder';

export default {
    listFolders: paginated<ListContainerFoldersParams, PaginatedResponse<ContainerFolder>>('/folders'),
    getFolder: get<GetContainerFolderParams, ContainerFolder>('/folders/:folderId'),
    createFolder: post<CreateContainerFolderParams, ContainerFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateFolder: patch<UpdateContainerFolderParams, ContainerFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<DeleteContainerFolderParams>('/folders/:folderId')
};
