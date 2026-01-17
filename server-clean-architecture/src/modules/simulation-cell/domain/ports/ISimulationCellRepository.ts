import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import SimulationCell, { SimulationCellProps } from "../entities/SimulationCell";

export interface ISimulationCellRepository extends IBaseRepository<SimulationCell, SimulationCellProps> {
};
