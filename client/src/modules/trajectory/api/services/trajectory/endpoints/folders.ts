import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import type { CreateTrajectoryFolderParams } from '../../../dtos/trajectory/create-trajectory-folder';
import type { DeleteTrajectoryFolderParams } from '../../../dtos/trajectory/delete-trajectory-folder';
import type { GetTrajectoryFolderParams } from '../../../dtos/trajectory/get-trajectory-folder';
import type { ListTrajectoryFoldersParams } from '../../../dtos/trajectory/list-trajectory-folders';
import type { UpdateTrajectoryFolderParams } from '../../../dtos/trajectory/update-trajectory-folder';
import type { TrajectoryFolder } from '../../../entities/trajectory/trajectory-folder';

export default createFolderCrudEndpoints<
    ListTrajectoryFoldersParams,
    GetTrajectoryFolderParams,
    CreateTrajectoryFolderParams,
    UpdateTrajectoryFolderParams,
    DeleteTrajectoryFolderParams,
    TrajectoryFolder
>();
