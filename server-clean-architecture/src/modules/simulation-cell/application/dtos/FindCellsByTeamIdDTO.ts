import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface FindCellsByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
}

export interface FindCellsByTeamIdOutputDTO extends PaginatedResult<SimulationCellProps> { }
