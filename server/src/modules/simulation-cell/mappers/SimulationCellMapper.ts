import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createSimulationCell } from '@modules/simulation-cell/entities/SimulationCell';
import type SimulationCell from '@modules/simulation-cell/entities/SimulationCell';
import type { SimulationCellProps } from '@modules/simulation-cell/entities/SimulationCell';
import type { SimulationCellDocument } from '@modules/simulation-cell/models/SimulationCellModel';

export default createMongoMapperFromFactory<SimulationCell, SimulationCellProps, SimulationCellDocument>(createSimulationCell, [
    'team',
    'trajectory'
]);
