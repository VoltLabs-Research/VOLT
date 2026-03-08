import { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { User } from '@/modules/auth/api/entities/user';
import type { Team } from '@/modules/team/api/entities/team';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { TrajectoryStats } from '@/modules/trajectory/api/entities/trajectory-stats';
import type { TrajectoryProcessingProgress } from '@/modules/trajectory/api/entities/trajectory-processing';
import type { AvailableModels } from '@/modules/trajectory/api/entities/available-models';
import type { TimestepInfo } from '@/modules/trajectory/api/entities/timestep-info';

export type TrajectoryStatus =
    | 'waiting_for_process'
    | 'queued'
    | 'processing'
    | 'rendering'
    | 'completed'
    | 'failed';

export interface Trajectory extends BaseEntity {
    name: string;
    team: Team | string;
    analysis: Analysis[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    preview?: string;
    isPublic?: boolean;
    status?: TrajectoryStatus;
    processingProgress?: TrajectoryProcessingProgress;
    users: (User | string)[];
    createdBy?: User | string;
    availableModels?: AvailableModels;
}
