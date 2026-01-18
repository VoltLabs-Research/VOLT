import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import SimulationCell, { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface ISimulationCellRepository extends IBaseRepository<SimulationCell, SimulationCellProps> {
};
