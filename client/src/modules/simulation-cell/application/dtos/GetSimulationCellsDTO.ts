import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SimulationCell } from '../../domain/entities';

export interface GetSimulationCellsInputDTO {
    page: number;
    limit: number;
    search?: string;
};

export type GetSimulationCellsOutputDTO = PaginatedResponse<SimulationCell>;
