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
