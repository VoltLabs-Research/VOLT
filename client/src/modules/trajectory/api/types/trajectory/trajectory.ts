import { BaseEntity } from '@/shared/types/BaseEntity';
import type { User } from '@/modules/auth/api/types/user';
import type { TeamCluster } from '@/modules/cluster/api/types/team-cluster';
import type { Team } from '@/modules/team/api/types/team/team';
import type { Analysis } from '@/modules/analysis/api/types/analysis';
import type { TrajectoryStats } from './trajectory-stats';
import type { TimestepInfo } from './timestep-info';

export type TrajectoryStatus =
    | 'waiting-for-process'
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed';

export interface Trajectory extends BaseEntity {
    name: string;
    team: Team | string;
    folder: string | null;
    analysis: Analysis[];
    frames: TimestepInfo[];
    framesCount?: number;
    atoms?: number;
    firstTimestep?: number;
    stats: TrajectoryStats;
    hasPreview?: boolean;
    preview?: string;
    isPublic?: boolean;
    status?: TrajectoryStatus;
    users: (User | string)[];
    createdBy?: User | string;
    storageClusterId?: TeamCluster | string | null;
}
