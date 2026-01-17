import { PaginatedResult } from "@/src/shared/domain/ports/IBaseRepository";
import { PluginProps } from "../../../domain/entities/Plugin";

export interface ListPluginsInputDTO {
    teamId: string;
    userId: string;
    page: number;
    limit: number;
}

export interface ListPluginsOutputDTO extends PaginatedResult<PluginProps> { }