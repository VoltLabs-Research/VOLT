export interface RegistryPackageDownloads{
    total: number;
    last30d: number;
}

export interface RegistryPackageSummary{
    fullName: string;
    name: string;
    username: string;
    kind: string;
    description?: string;
    keywords?: string[];
    latest?: string;
    downloads?: RegistryPackageDownloads;
    updatedAt?: string;
}

export interface SearchRegistryResponse{
    items: RegistryPackageSummary[];
    page: number;
    pageSize: number;
    total: number;
}
