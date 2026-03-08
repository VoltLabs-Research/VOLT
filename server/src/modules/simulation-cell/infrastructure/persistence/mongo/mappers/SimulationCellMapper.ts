import SimulationCell, { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

class SimulationCellMapper extends BaseMapper<SimulationCell, SimulationCellProps, SimulationCellDocument> {
    constructor() {
        super(SimulationCell, [
            'team',
            'trajectory'
        ]);
    }
}

export default new SimulationCellMapper();
