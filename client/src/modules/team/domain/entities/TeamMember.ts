import { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface TeamMember extends BaseEntity {
    team: any;
    user: any;
    role: any;
    joinedAt: Date;
};
