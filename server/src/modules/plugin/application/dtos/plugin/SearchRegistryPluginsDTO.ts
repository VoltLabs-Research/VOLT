import type { RegistrySearchResult } from '@modules/plugin/infrastructure/services/plugin/RegistryGateway';

export interface SearchRegistryPluginsInputDTO {
    teamId: string;
    q?: string;
    page?: number;
    limit?: number;
}

export interface SearchRegistryPluginsOutputDTO extends RegistrySearchResult { };
