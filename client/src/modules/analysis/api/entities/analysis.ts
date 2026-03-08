import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export interface AnalysisTrajectory {
    _id: string;
    name: string;
};

export interface Analysis extends BaseEntity {
    plugin: string;
    pluginDisplayName?: string;
    config: Record<string, unknown>;
    trajectory: AnalysisTrajectory;
    totalFrames: number;
    completedFrames: number;
    startedAt?: Date;
    finishedAt?: Date;
    status: string;
};
