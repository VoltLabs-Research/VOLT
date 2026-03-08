import { get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { Team } from '../../../entities/team/team';
import type { CreateTeamInputDTO } from '../../../dtos/team/create-team';
import type { UpdateTeamInputDTO } from '../../../dtos/team/update-team';
import type { DeleteTeamInputDTO } from '../../../dtos/team/delete-team';

export default {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInputDTO, Team>('/'),
    update: patch<UpdateTeamInputDTO, Team>('/:teamId'),
    delete: del<DeleteTeamInputDTO>('/:teamId')
};
