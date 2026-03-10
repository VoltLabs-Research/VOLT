import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

export default createMongoMapper<SimulationCell, SimulationCellProps, SimulationCellDocument>(SimulationCell, [
    'team',
    'trajectory'
]);
