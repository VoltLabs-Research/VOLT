import { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface User extends BaseEntity {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    avatar?: string;
    lastLoginAt?: string;
    lastSeenAt?: string | null;
    isOnline?: boolean;
};
