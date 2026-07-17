import type { User } from '@/modules/auth/api/types/user';
import type { BaseEntity } from '@/shared/types/BaseEntity';

export interface SecretKey extends BaseEntity {
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    createdBy?: User | string;
    isActive: boolean;
    lastUsedAt?: string;
}
