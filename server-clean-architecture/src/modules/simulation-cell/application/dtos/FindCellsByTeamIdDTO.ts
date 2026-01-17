import { PaginatedResult } from "@/src/shared/domain/ports/IBaseRepository";
import { SimulationCellProps } from "../../domain/entities/SimulationCell";

export interface FindCellsByTeamIdInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
}

export interface FindCellsByTeamIdOutputDTO extends PaginatedResult<SimulationCellProps> { }
