import {
    EntityOutputDTO,
    EntityIdInputDTO,
} from '@modules/team/application/dtos/common';
import { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export type UpdateTeamRoleByIdInputDTO = EntityIdInputDTO<'roleId'> & Partial<Pick<TeamRoleProps, 'name' | 'permissions'>>;

export type UpdateTeamRoleByIdOutputDTO = EntityOutputDTO<TeamRoleProps>;
