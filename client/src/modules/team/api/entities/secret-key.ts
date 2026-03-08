import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface SecretKey extends BaseEntity {
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: string;
};
