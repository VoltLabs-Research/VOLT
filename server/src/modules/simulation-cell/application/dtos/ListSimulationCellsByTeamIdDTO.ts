import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface ListSimulationCellsByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    trajectoryId?: string;
    timestep?: number;
};

export interface ListSimulationCellsByTeamIdItemDTO extends SimulationCellProps {
    _id: string;
};

export interface ListSimulationCellsByTeamIdOutputDTO extends PaginatedResult<ListSimulationCellsByTeamIdItemDTO> {
};
