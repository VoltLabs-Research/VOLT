import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { PluginProps } from '@modules/plugin/domain/entities/Plugin';

export interface ListPluginsInputDTO {
    teamId: string;
    userId: string;
    page?: number;
    limit?: number;
}

export interface ListPluginsOutputDTO extends PaginatedResult<PluginProps> { }
