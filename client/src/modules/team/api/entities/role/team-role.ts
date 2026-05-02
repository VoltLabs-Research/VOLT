import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface TeamRole extends BaseEntity {
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
}
