import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import TeamRole, { TeamRoleProps } from '@modules/team/domain/entities/TeamRole';

export interface ITeamRoleRepository extends IBaseRepository<TeamRole, TeamRoleProps>{};