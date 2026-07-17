import type { BaseEntity } from '@/shared/types/BaseEntity';

export interface ContainerFolder extends BaseEntity {
    title: string;
    parent: string | null;
}
