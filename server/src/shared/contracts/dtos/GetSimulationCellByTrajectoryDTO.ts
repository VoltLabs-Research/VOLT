/**
 * Neutral, cross-module DTO contract for "get simulation cell by trajectory".
 * Extracted from
 * `@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO`
 * during the detachable-modules migration. The owner re-exports both names so
 * existing importers compile unchanged.
 *
 * Built on the neutral `SimulationCellProps` structural contract
 * (`@shared/contracts/types/SimulationCell`). Pure type — no `@modules/*`
 * imports.
 */
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { SimulationCellProps } from '@shared/contracts/types/SimulationCell';

export interface GetSimulationCellByTrajectoryInputDTO {
    teamId: string;
    trajectoryId: string;
    timestep?: number;
}

export type GetSimulationCellByTrajectoryOutputDTO = PersistedOutput<SimulationCellProps> | null;
