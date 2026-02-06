import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SimulationCell } from '../entities';

export interface GetSimulationCellsParams {
    page?: number;
    limit?: number;
    search?: string;
};

export default interface ISimulationCellRepository {
    getAll(params?: GetSimulationCellsParams): Promise<PaginatedResponse<SimulationCell>>;
};
