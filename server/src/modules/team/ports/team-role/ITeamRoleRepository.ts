import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type TeamRole from '@modules/team/entities/team-role/TeamRole';
import type { TeamRoleProps } from '@modules/team/entities/team-role/TeamRole';

export interface ITeamRoleRepository extends IBaseRepository<TeamRole, TeamRoleProps> {}
