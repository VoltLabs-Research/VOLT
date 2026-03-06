import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SimulationCell, { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface ISimulationCellRepository extends IBaseRepository<SimulationCell, SimulationCellProps> {
};
