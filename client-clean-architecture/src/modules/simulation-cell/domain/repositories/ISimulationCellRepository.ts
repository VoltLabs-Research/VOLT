import type { PaginatedResponse } from '@/shared/types/api';
import type { SimulationCell } from '../entities/SimulationCell';

export interface GetSimulationCellParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface ISimulationCellRepository {
    getAll(teamId: string, params: GetSimulationCellParams): Promise<PaginatedResponse<SimulationCell>>;
    getById(id: string): Promise<SimulationCell>;
}
