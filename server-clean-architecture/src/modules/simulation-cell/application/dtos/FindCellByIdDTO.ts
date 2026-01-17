import { SimulationCellProps } from "../../domain/entities/SimulationCell";

export interface FindCellByIdInputDTO {
    id: string;
}

export interface FindCellByIdOutputDTO extends SimulationCellProps { }
