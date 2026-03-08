import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/team-role/TeamRole';

export interface ITeamRoleRepository extends IBaseRepository<TeamRole, TeamRoleProps>{};