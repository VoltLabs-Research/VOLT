import type { User } from '@/modules/auth/api/entities/user';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
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
    teamCluster?: TeamCluster | string | null;
    createdBy?: User | string;
    totalFrames: number;
    completedFrames: number;
    startedAt?: Date;
    finishedAt?: Date;
    status: string;
};
