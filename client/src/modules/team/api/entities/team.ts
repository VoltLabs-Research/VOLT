import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface Team extends BaseEntity {
    name: string;
    description?: string;
    owner: any;
};
