import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { PaginatedTeamScopedInputDTO, TeamScopedPaginatedOutputDTO } from '@modules/team/application/dtos/common';

export type ListSimulationCellsByTeamIdInputDTO = PaginatedTeamScopedInputDTO & {
    trajectoryId?: string;
    timestep?: number;
};

export interface ListSimulationCellsByTeamIdItemDTO extends SimulationCellProps {
    _id: string;
};

export type ListSimulationCellsByTeamIdOutputDTO = TeamScopedPaginatedOutputDTO<ListSimulationCellsByTeamIdItemDTO>;
