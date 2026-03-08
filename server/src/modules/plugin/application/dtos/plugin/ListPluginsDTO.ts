import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface ListPluginsInputDTO {
    teamId: string;
    userId: string;
    page?: number;
    limit?: number;
}

export interface ListedPluginDTO extends PersistedPluginDTO { }

export interface ListPluginsOutputDTO extends PaginatedResult<ListedPluginDTO> { }
