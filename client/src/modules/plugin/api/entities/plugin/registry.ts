export interface RegistryPackageSummary {
    fullName: string;
    name: string;
    username: string;
    kind: string;
    description?: string;
    latest?: string;
    downloads?: { total: number; last30d: number };
}

export interface RegistrySearchResponse {
    items: RegistryPackageSummary[];
    page: number;
    pageSize: number;
    total: number;
}
