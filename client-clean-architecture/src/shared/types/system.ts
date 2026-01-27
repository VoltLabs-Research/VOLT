export interface SystemStats {
    cpu: {
        usage: number;
        cores: number;
    };
    memory: {
        total: number;
        used: number;
        free: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
    };
    [key: string]: any;
}

export interface RBACResource {
    key: string;
    label: string;
}

export interface RBACAction {
    key: string;
    label: string;
}

export interface RBACConfig {
    resources: RBACResource[];
    actions: RBACAction[];
}

export interface GetSystemStats {
    stats: SystemStats;
}
