import { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface GetSimulationCellByIdInputDTO {
    simulationCellId: string;
}

export interface GetSimulationCellByIdOutputDTO extends SimulationCellProps {
    _id: string;
}
