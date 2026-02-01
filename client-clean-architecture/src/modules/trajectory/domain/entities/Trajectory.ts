import type { User } from '@/modules/auth/domain/entities';
import type { Team } from '@/modules/team/domain/entities';
import type { TrajectoryStats } from './TrajectoryStats';
import type { TrajectoryProcessingProgress } from './TrajectoryProcessingProgress';
import type { TimestepInfo } from './TimestepInfo';
import type { Analysis } from './Analysis';
import type { AvailableModels } from './AvailableModels';

export type TrajectoryStatus = 
    | 'waiting_for_process'
    | 'queued'
    | 'processing'
    | 'rendering'
    | 'completed'
    | 'failed';

export interface Trajectory{
    _id: string;
    name: string;
    team: Team | string;
    analysis: Analysis[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    preview?: string;
    isPublic?: boolean;
    status?: TrajectoryStatus;
    processingProgress?: TrajectoryProcessingProgress;
    createdAt: string;
    updatedAt: string;
    users: (User | string)[];
    createdBy?: User | string;
    availableModels?: AvailableModels;
};
