import { injectable } from 'tsyringe';
import BaseRepository, { RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ISimulationCellRepository from '../../domain/ports/ISimulationCellRepository';
import type { GetSimulationCellsParams } from '../../domain/ports/ISimulationCellRepository';
import type { SimulationCell } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class SimulationCellRepository extends BaseRepository implements ISimulationCellRepository {
    constructor() {
        super('/simulation-cell', { useRBAC: true });
    }

    async getAll(params?: GetSimulationCellsParams): Promise<PaginatedResponse<SimulationCell>> {
        const raw = await this.client.get<RawPaginatedResponse<SimulationCell>>('/', params);
        return this.unwrapPaginated(raw);
    }
};
