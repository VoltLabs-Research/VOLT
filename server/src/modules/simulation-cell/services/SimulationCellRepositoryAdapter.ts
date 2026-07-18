import SimulationCellModel from '@modules/simulation-cell/models/SimulationCellModel';
import type { SimulationCellDocument } from '@modules/simulation-cell/models/SimulationCellModel';
import type { SimulationCellLike, SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

const simulationCellMapper = createMongoMapperFromFactory<SimulationCellLike, SimulationCellProps, SimulationCellDocument>(
    (_id, props) => ({ _id, props }),
    ['team', 'trajectory']
);

export default class SimulationCellRepositoryAdapter
    extends MongooseBaseRepository<SimulationCellLike, SimulationCellProps, SimulationCellDocument> {

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
