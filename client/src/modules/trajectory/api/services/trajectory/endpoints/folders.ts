import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateTrajectoryFolderParams } from '../../../dtos/trajectory/create-trajectory-folder';
import type { DeleteTrajectoryFolderParams } from '../../../dtos/trajectory/delete-trajectory-folder';
import type { GetTrajectoryFolderParams } from '../../../dtos/trajectory/get-trajectory-folder';
import type { ListTrajectoryFoldersParams } from '../../../dtos/trajectory/list-trajectory-folders';
import type { UpdateTrajectoryFolderParams } from '../../../dtos/trajectory/update-trajectory-folder';
import type { TrajectoryFolder } from '../../../entities/trajectory/trajectory-folder';

export default {
    listFolders: paginated<ListTrajectoryFoldersParams, PaginatedResponse<TrajectoryFolder>>('/folders'),
    getFolder: get<GetTrajectoryFolderParams, TrajectoryFolder>('/folders/:folderId'),
    createFolder: post<CreateTrajectoryFolderParams, TrajectoryFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateFolder: patch<UpdateTrajectoryFolderParams, TrajectoryFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<DeleteTrajectoryFolderParams>('/folders/:folderId')
};
