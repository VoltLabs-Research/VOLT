import type { BaseEntity } from '@/shared/types/BaseEntity';
import type { User } from '@/modules/auth/api/types/user';
import type { Team } from '@/modules/team/api/types/team/team';
import type { TeamRole } from '@/modules/team/api/types/role/team-role';

export interface TeamMember extends BaseEntity {
    team: Team | string;
    user: User;
    role: TeamRole;
    joinedAt: Date;
}

export interface TeamMemberStats extends TeamMember {
    trajectoriesCount: number;
    analysesCount: number;
    latexCount: number;
    whiteboardsCount: number;
}
