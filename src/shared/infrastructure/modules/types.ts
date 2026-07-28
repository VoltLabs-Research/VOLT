export type ModuleTier = 'kernel' | 'capability' | 'compute' | 'leaf';

export interface ModuleManifest {
    key: string;
    tier: ModuleTier;
    requires?: string[];
    optional?: string[];
    description?: string;
}
