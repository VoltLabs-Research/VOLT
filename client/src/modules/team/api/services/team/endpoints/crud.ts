import { get, post, patch, del, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { Team } from '../../../entities/team';
import type { CreateTeamInputDTO } from '../../../dtos/create-team';
import type { UpdateTeamInputDTO } from '../../../dtos/update-team';
import type { DeleteTeamInputDTO } from '../../../dtos/delete-team';

const endpoints = {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInputDTO, Team>('/'),
    update: patch<UpdateTeamInputDTO, Team>('/:teamId'),
    delete: del<DeleteTeamInputDTO>('/:teamId')
};

export default endpoints;
