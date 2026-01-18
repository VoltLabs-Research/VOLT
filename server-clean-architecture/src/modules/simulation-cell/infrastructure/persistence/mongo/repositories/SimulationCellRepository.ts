import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import SimulationCell, { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/ports/ISimulationCellRepository';
import SimulationCellModel, { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';
import simulationCellMapper from '@modules/simulation-cell/infrastructure/persistence/mongo/mappers/SimulationCellMapper';

@injectable()
export default class SimulationCellRepository
    extends MongooseBaseRepository<SimulationCell, SimulationCellProps, SimulationCellDocument>
    implements ISimulationCellRepository {

    constructor() {
        super(SimulationCellModel, simulationCellMapper);
    }
}
