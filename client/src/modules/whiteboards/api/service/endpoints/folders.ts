import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import type { CreateWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/create-whiteboard-folder-params';
import type { DeleteWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/delete-whiteboard-folder-params';
import type { GetWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/get-whiteboard-folder-params';
import type { ListWhiteboardFoldersParams } from '@/modules/whiteboards/api/dtos/list-whiteboard-folders-params';
import type { UpdateWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/update-whiteboard-folder-params';
import type { WhiteboardFolder } from '@/modules/whiteboards/api/entities/whiteboard-folder';

const folderEndpoints = createFolderCrudEndpoints<
    ListWhiteboardFoldersParams,
    GetWhiteboardFolderParams,
    CreateWhiteboardFolderParams,
    UpdateWhiteboardFolderParams,
    DeleteWhiteboardFolderParams,
    WhiteboardFolder
>();

const endpoints = {
    listWhiteboardFolders: folderEndpoints.listFolders,
    getWhiteboardFolder: folderEndpoints.getFolder,
    createWhiteboardFolder: folderEndpoints.createFolder,
    updateWhiteboardFolder: folderEndpoints.updateFolder,
    deleteWhiteboardFolder: folderEndpoints.deleteFolder
};

export default endpoints;
