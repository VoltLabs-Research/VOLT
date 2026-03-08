import { get, del } from '@/app/core/http/utilities/create-service';
import type { UnwrapMode } from '@/app/core/http/utilities/create-service';
import type { GetTeamPermissionsInputDTO } from '../../../dtos/team/get-team-permissions';
import type { GetTeamPermissionsOutputDTO } from '../../../dtos/team/get-team-permissions';
import type { LeaveTeamInputDTO } from '../../../dtos/team/leave-team';

const TEAM_PERMISSIONS_UNWRAP: UnwrapMode = { field: 'permissions' };

export default {
    leave: del<LeaveTeamInputDTO>('/:teamId/self/membership', { unwrap: 'void' }),
    getMyPermissions: get<GetTeamPermissionsInputDTO, GetTeamPermissionsOutputDTO>(
        '/:teamId/self/permissions', {
            unwrap: TEAM_PERMISSIONS_UNWRAP
        }
    )
};
