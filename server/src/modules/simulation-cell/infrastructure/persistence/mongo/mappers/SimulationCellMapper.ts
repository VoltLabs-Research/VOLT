import { IMapper } from '@shared/infrastructure/persistence/IMapper';
import SimulationCell, { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import { SimulationCellDocument } from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';

class SimulationCellMapper implements IMapper<SimulationCell, SimulationCellProps, SimulationCellDocument> {
    toDomain(document: SimulationCellDocument): SimulationCell {
        const { _id, ...props } = document.toObject ? document.toObject() : document;
        delete props.__v;
        return new SimulationCell(_id.toString(), props);
    }

    toPersistence(domain: SimulationCellProps): any {
        const { createdAt, updatedAt, ...persistProps } = domain;
        return persistProps;
    }
}

export default new SimulationCellMapper();
