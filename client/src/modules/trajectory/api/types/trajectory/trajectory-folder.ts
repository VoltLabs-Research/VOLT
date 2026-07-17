import type { BaseEntity } from '@/shared/types/BaseEntity';

export interface TrajectoryFolder extends BaseEntity {
    title: string;
    parent: string | null;
}
