import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/create-whiteboard-folder-params';
import type { DeleteWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/delete-whiteboard-folder-params';
import type { GetWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/get-whiteboard-folder-params';
import type { ListWhiteboardFoldersParams } from '@/modules/whiteboards/api/dtos/list-whiteboard-folders-params';
import type { UpdateWhiteboardFolderParams } from '@/modules/whiteboards/api/dtos/update-whiteboard-folder-params';
import type { WhiteboardFolder } from '@/modules/whiteboards/api/entities/whiteboard-folder';

const endpoints = {
    listWhiteboardFolders: paginated<ListWhiteboardFoldersParams, PaginatedResponse<WhiteboardFolder>>('/folders'),
    getWhiteboardFolder: get<GetWhiteboardFolderParams, WhiteboardFolder>('/folders/:folderId'),
    createWhiteboardFolder: post<CreateWhiteboardFolderParams, WhiteboardFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateWhiteboardFolder: patch<UpdateWhiteboardFolderParams, WhiteboardFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteWhiteboardFolder: del<DeleteWhiteboardFolderParams>('/folders/:folderId')
};

export default endpoints;
