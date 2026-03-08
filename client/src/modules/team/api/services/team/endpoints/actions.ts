import { get, post } from '@/app/core/http/utilities/create-service';
import type { GetTeamPermissionsInputDTO } from '../../../dtos/get-team-permissions';
import type { LeaveTeamInputDTO } from '../../../dtos/leave-team';

const endpoints = {
    leave: post<LeaveTeamInputDTO, void>('/:teamId/self/leave', { unwrap: 'void' }),
    getMyPermissions: get<GetTeamPermissionsInputDTO, string[]>(
        '/:teamId/self/permissions', {
            unwrap: { field: 'permissions' },
            map: (result) => (result as string[] | undefined) ?? []
        }
    )
};

export default endpoints;
