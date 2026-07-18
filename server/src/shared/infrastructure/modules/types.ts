
export type ModuleTier = 'kernel' | 'capability' | 'compute' | 'leaf' | 'client-only';

export interface ModuleManifest {
    
    key: string;
    
    tier: ModuleTier;
    
    requires?: string[];
    
    optional?: string[];
    
    description?: string;
}
