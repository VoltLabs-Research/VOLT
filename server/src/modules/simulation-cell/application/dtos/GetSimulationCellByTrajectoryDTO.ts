import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface GetSimulationCellByTrajectoryInputDTO {
    teamId: string;
    trajectoryId: string;
    timestep?: number;
}

export type GetSimulationCellByTrajectoryOutputDTO = PersistedOutput<SimulationCellProps> | null;
