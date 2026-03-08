import { get, del } from '@/app/core/http/utilities/create-service';
import type { GetTeamPermissionsInputDTO } from '../../../dtos/get-team-permissions';
import type { LeaveTeamInputDTO } from '../../../dtos/leave-team';

const endpoints = {
    leave: del<LeaveTeamInputDTO>('/:teamId/self/membership', { unwrap: 'void' }),
    getMyPermissions: get<GetTeamPermissionsInputDTO, string[]>(
        '/:teamId/self/permissions', {
            unwrap: { field: 'permissions' },
            map: (result) => (result as string[] | undefined) ?? []
        }
    )
};

export default endpoints;
