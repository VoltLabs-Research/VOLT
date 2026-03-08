import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface ListSimulationCellsByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    trajectoryId?: string;
    timestep?: number;
}

export interface ListSimulationCellsByTeamIdItemDTO extends SimulationCellProps {
    _id: string;
}

export interface ListSimulationCellsByTeamIdOutputDTO extends PaginatedResult<ListSimulationCellsByTeamIdItemDTO> { }
