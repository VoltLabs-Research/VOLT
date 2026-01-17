import { IMapper } from "@/src/shared/infrastructure/persistence/IMapper";
import SimulationCell, { SimulationCellProps } from "../../../../domain/entities/SimulationCell";
import { SimulationCellDocument } from "../models/SimulationCellModel";

class SimulationCellMapper implements IMapper<SimulationCell, SimulationCellProps, SimulationCellDocument> {
    toDomain(document: SimulationCellDocument): SimulationCell {
        const { _id, ...props } = document.toObject ? document.toObject() : document;
        return new SimulationCell(_id.toString(), props);
    }

    toPersistence(domain: SimulationCellProps): any {
        return {
            ...domain
        };
    }
}

export default new SimulationCellMapper();
