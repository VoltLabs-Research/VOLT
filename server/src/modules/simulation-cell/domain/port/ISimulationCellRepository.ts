import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface ISimulationCellRepository extends IBaseRepository<SimulationCell, SimulationCellProps> {
    createMany(items: Array<Partial<SimulationCellProps>>): Promise<SimulationCell[]>;
}
