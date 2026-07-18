import SimulationCellModel from '@modules/simulation-cell/models/SimulationCellModel';
import type { SimulationCellDocument } from '@modules/simulation-cell/models/SimulationCellModel';
import { SIMULATION_CELL_CONTRACT_TOKENS } from '@shared/contracts/tokens/SimulationCellTokens';
import type { ISimulationCellRepository } from '@shared/contracts/ports/ISimulationCellRepository';
import type { SimulationCellLike, SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

/**
 * Cross-module model-backed adapter registered under the neutral
 * `SIMULATION_CELL_CONTRACT_TOKENS.SimulationCellRepository` token so
 * `@modules/trajectory` (commit-upload `createMany`) and the cascade-delete
 * subscriptions (`deleteMany`) keep working without importing the owner's
 * internals. Mirrors container's `ContainerSearchRepository`: it is the module's
 * ONLY remaining repository — the simulation-cell HTTP code talks to
 * {@link SimulationCellModel} directly via {@link SimulationCellService}. The
 * `{ _id, props }` entity is produced by an inline factory mapper (no separate
 * entity/mapper files).
 */
const simulationCellMapper = createMongoMapperFromFactory<SimulationCellLike, SimulationCellProps, SimulationCellDocument>(
    (_id, props) => ({ _id, props }),
    ['team', 'trajectory']
);

@Singleton(SIMULATION_CELL_CONTRACT_TOKENS.SimulationCellRepository)
export default class SimulationCellRepositoryAdapter
    extends MongooseBaseRepository<SimulationCellLike, SimulationCellProps, SimulationCellDocument>
    implements ISimulationCellRepository {

    constructor() {
        super(SimulationCellModel, simulationCellMapper);
    }

    async createMany(items: Array<Partial<SimulationCellProps>>): Promise<SimulationCellLike[]> {
        if (items.length === 0) return [];

        const persistenceDocs = items.map((item) => this.mapper.toPersistence(item));
        const inserted = await this.model.insertMany(persistenceDocs, { ordered: true });
        return inserted.map((doc) => this.mapper.toDomain(doc as SimulationCellDocument));
    }
}
