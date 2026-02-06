import { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

export interface FindCellByIdInputDTO {
    id: string;
}

export interface FindCellByIdOutputDTO extends SimulationCellProps { }
