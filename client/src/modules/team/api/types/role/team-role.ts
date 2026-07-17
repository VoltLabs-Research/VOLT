import type { BaseEntity } from '@/shared/types/BaseEntity';

export interface TeamRole extends BaseEntity {
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
}
