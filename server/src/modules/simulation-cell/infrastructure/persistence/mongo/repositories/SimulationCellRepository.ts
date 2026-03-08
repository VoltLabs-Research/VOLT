import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import simulationCellMapper from '@modules/simulation-cell/infrastructure/persistence/mongo/mappers/SimulationCellMapper';
import SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import SimulationCellModel from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';
import { injectable } from 'tsyringe';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

@injectable()
export default class SimulationCellRepository
    extends MongooseBaseRepository<SimulationCell, SimulationCellProps, SimulationCellDocument>
    implements ISimulationCellRepository {

    constructor() {
        super(SimulationCellModel, simulationCellMapper);
    }
};
