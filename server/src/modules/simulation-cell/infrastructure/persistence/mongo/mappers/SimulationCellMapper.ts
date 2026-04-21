import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapperFromFactory';
import { createSimulationCell } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

export default createMongoMapperFromFactory<SimulationCell, SimulationCellProps, SimulationCellDocument>(createSimulationCell, [
    'team',
    'trajectory'
]);
