

import { assertWireMatch } from '@shared/contracts/assert-wire-match';
import type { Equal } from '@shared/contracts/assert-wire-match';
import type {
    TrajectoryStats,
    TrajectoryStatus as WireTrajectoryStatus
} from '@volt/contracts/modules/trajectory/domain';

export enum TrajectoryStatus {
    Queued = 'queued',
    WaitingForProcess = 'waiting-for-process',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
}

assertWireMatch<Equal<`${TrajectoryStatus}`, WireTrajectoryStatus>>();

export interface TrajectoryFrameSimulationCellEmbed {
    _id: string;
    boundingBox: { width: number; height: number; length: number };
    geometry: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
    };
    team?: string;
    trajectory?: string;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell?: string | TrajectoryFrameSimulationCellEmbed;
}

export interface TrajectoryProps {
    name: string;
    team: string;
    folder: string | null;
    storageClusterId?: string;
    createdBy: string;
    status: TrajectoryStatus;
    isPublic: boolean;
    frames?: TrajectoryFrame[];
    framesCount?: number;
    atoms?: number;
    firstTimestep?: number;
    analysis?: string[];
    hasPreview?: boolean;
    stats: TrajectoryStats;
    updatedAt: Date;
    createdAt: Date;
}

export interface TrajectoryLike {
    _id: string;
    props: TrajectoryProps;
}
