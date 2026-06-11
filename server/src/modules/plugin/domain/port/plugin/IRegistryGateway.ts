import type {
    RegistrySearchResult,
    ResolvedRegistryTarball
} from '@modules/plugin/domain/contracts/plugin/RegistryGateway';

export interface IRegistryGateway {
    search(q: string, page: number, pageSize: number): Promise<RegistrySearchResult>;
    resolveTarball(fullName: string, version: string | undefined, platform: string): Promise<ResolvedRegistryTarball>;
}
