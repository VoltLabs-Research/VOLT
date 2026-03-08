import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';

export interface TeamMember extends BaseEntity {
    team: Team | string;
    user: User;
    role: TeamRole;
    joinedAt: Date;
};

export interface TeamMemberStats extends TeamMember {
    timeSpentLast7Days: number;
    trajectoriesCount: number;
    analysesCount: number;
};
