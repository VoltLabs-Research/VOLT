import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';

export interface Team extends BaseEntity {
    name: string;
    description?: string;
    owner: User;
};
