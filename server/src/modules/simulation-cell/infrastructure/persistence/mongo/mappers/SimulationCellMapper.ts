import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import SimulationCell from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

class SimulationCellMapper extends BaseMapper<SimulationCell, SimulationCellProps, SimulationCellDocument> {
    constructor() {
        super(SimulationCell, [
            'team',
            'trajectory'
        ]);
    }
};

export default new SimulationCellMapper();
