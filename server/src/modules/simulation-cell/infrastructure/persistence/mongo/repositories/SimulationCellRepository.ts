import type SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { ISimulationCellRepository } from '@shared/contracts/ports/ISimulationCellRepository';
import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens/SimulationCellTokens';
import simulationCellMapper from '@modules/simulation-cell/infrastructure/persistence/mongo/mappers/SimulationCellMapper';
import SimulationCellModel from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

@Singleton(SIMULATION_CELL_CONTRACT_TOKENS.SimulationCellRepository)
export default class SimulationCellRepository
    extends MongooseBaseRepository<SimulationCell, SimulationCellProps, SimulationCellDocument>
    implements ISimulationCellRepository {

    constructor() {
        super(SimulationCellModel, simulationCellMapper);
    }

    async createMany(items: Array<Partial<SimulationCellProps>>): Promise<SimulationCell[]> {
        if (items.length === 0) return [];

        const persistenceDocs = items.map((item) => this.mapper.toPersistence(item));
        const inserted = await this.model.insertMany(persistenceDocs, { ordered: true });
        return inserted.map((doc) => this.mapper.toDomain(doc as SimulationCellDocument));
    }
}
