import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface TrajectoryFolder extends BaseEntity {
    title: string;
    parent: string | null;
}
