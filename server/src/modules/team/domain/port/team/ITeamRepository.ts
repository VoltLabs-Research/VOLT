import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type Team from '@modules/team/domain/entities/team/Team';
import type { TeamProps } from '@modules/team/domain/entities/team/Team';
import type { PersistedEntityOutput } from '@shared/domain/persisted/to-persisted-entity';

export interface ITeamRepository extends IBaseRepository<Team, TeamProps> {
    removeUserFromAllTeams(userId: string): Promise<void>;
    findUserTeams(userId: string): Promise<PersistedEntityOutput<TeamProps>[]>;
    findByInviteCode(code: string): Promise<Team | null>;
    clearInviteCode(teamId: string): Promise<void>;
}
