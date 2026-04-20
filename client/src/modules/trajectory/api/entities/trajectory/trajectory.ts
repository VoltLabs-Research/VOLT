import { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { TrajectoryStats } from './trajectory-stats';
import type { TrajectoryProcessingProgress } from './trajectory-processing';
import type { AvailableModels } from './available-models';
import type { TimestepInfo } from './timestep-info';

export type TrajectoryStatus =
    | 'waiting-for-process'
    | 'queued'
    | 'processing'
    | 'rendering'
    | 'completed'
    | 'failed';

export interface Trajectory extends BaseEntity {
    name: string;
    team: Team | string;
    folder: string | null;
    analysis: Analysis[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    hasPreview?: boolean;
    preview?: string;
    isPublic?: boolean;
    status?: TrajectoryStatus;
    processingProgress?: TrajectoryProcessingProgress;
    users: (User | string)[];
    createdBy?: User | string;
    storageClusterId?: TeamCluster | string | null;
    availableModels?: AvailableModels;
};
