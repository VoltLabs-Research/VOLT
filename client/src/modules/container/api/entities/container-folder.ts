import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface ContainerFolder extends BaseEntity {
    title: string;
    parent: string | null;
}
