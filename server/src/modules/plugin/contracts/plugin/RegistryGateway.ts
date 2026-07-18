export interface RegistryPackageSummary {
    fullName: string;
    name: string;
    username: string;
    kind: string;
    description?: string;
    keywords?: string[];
    latest?: string;
    downloads?: { total: number; last30d: number };
    updatedAt?: string;
}

export interface RegistrySearchResult {
    items: RegistryPackageSummary[];
    page: number;
    pageSize: number;
    total: number;
}

export interface ResolvedRegistryTarball {
    downloadUrl: string;
    sha256: string;
    fileName: string;
    version: string;
}
