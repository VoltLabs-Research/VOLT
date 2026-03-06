import { injectable } from 'tsyringe';
import BaseRepository from '@/shared/infrastructure/repositories/BaseRepository';
import type ISimulationCellRepository from '../../domain/port/ISimulationCellRepository';
import type { GetSimulationCellsParams } from '../../domain/port/ISimulationCellRepository';
import type { SimulationCell } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class SimulationCellRepository extends BaseRepository implements ISimulationCellRepository {
    constructor() {
        super('/simulation-cell', { useRBAC: true });
    }

    async getAll(params?: GetSimulationCellsParams): Promise<PaginatedResponse<SimulationCell>> {
        return this.getAllPaginated('/', params);
    }
};
