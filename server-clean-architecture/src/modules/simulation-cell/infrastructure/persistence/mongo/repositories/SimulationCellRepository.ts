import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";
import SimulationCell, { SimulationCellProps } from "../../../../domain/entities/SimulationCell";
import { ISimulationCellRepository } from "../../../../domain/ports/ISimulationCellRepository";
import SimulationCellModel, { SimulationCellDocument } from "../models/SimulationCellModel";
import simulationCellMapper from '../mappers/SimulationCellMapper';

@injectable()
export default class SimulationCellRepository
    extends MongooseBaseRepository<SimulationCell, SimulationCellProps, SimulationCellDocument>
    implements ISimulationCellRepository {

    constructor() {
        super(SimulationCellModel, simulationCellMapper);
    }
}
