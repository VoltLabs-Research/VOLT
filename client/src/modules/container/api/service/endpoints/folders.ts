import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import type { CreateContainerFolderParams } from '../../dtos/create-container-folder';
import type { DeleteContainerFolderParams } from '../../dtos/delete-container-folder';
import type { GetContainerFolderParams } from '../../dtos/get-container-folder';
import type { ListContainerFoldersParams } from '../../dtos/list-container-folders';
import type { UpdateContainerFolderParams } from '../../dtos/update-container-folder';
import type { ContainerFolder } from '../../entities/container-folder';

export default createFolderCrudEndpoints<
    ListContainerFoldersParams,
    GetContainerFolderParams,
    CreateContainerFolderParams,
    UpdateContainerFolderParams,
    DeleteContainerFolderParams,
    ContainerFolder
>();
