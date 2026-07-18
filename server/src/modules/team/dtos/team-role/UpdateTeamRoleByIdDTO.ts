import { EntityOutputDTO, EntityIdInputDTO } from '@modules/team/dtos/common';
import { TeamRoleProps } from '@modules/team/entities/team-role/TeamRole';

export type UpdateTeamRoleByIdInputDTO = EntityIdInputDTO<'roleId'> & Partial<Pick<TeamRoleProps, 'name' | 'permissions'>>;

export type UpdateTeamRoleByIdOutputDTO = EntityOutputDTO<TeamRoleProps>;
