import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { PaginatedResponse } from '@/shared/types/api';
import type { ISimulationCellRepository, GetSimulationCellParams } from '../../domain/repositories/ISimulationCellRepository';
import type { SimulationCell } from '../../domain/entities/SimulationCell';

export class SimulationCellRepository extends BaseRepository implements ISimulationCellRepository {
    constructor() {
        super('/simulation-cell', { useRBAC: false });
    }

    async getAll(teamId: string, params: GetSimulationCellParams): Promise<PaginatedResponse<SimulationCell>> {
        return this.get<PaginatedResponse<SimulationCell>>(`/${teamId}`, {
            query: params
        });
    }

    async getById(id: string): Promise<SimulationCell> {
        return this.get<SimulationCell>(`/${id}`);
    }
}

export const simulationCellRepository = new SimulationCellRepository();
