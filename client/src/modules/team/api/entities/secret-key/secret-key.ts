import type { User } from '@/modules/auth/api/entities/user';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface SecretKey extends BaseEntity {
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    createdBy?: User | string;
    isActive: boolean;
    lastUsedAt?: string;
};
