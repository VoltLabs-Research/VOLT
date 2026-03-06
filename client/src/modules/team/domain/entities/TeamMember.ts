import { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/domain/entities/User';
import type { Team } from './Team';
import type { TeamRole } from './TeamRole';

export interface TeamMember extends BaseEntity {
    team: Team | string;
    user: User;
    role: TeamRole;
    joinedAt: Date;
};
