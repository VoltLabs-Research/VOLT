import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface ListPluginsInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    status?: string;
}

export interface ListedPluginDTO extends PersistedPluginDTO { };

export interface ListPluginsOutputDTO extends PaginatedResult<ListedPluginDTO> { };
