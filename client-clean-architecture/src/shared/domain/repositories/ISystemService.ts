import type { SystemStats, RBACConfig } from '@/shared/types/system';

export interface ISystemService {
    getStats(): Promise<SystemStats>;
    getRBACConfig(): Promise<RBACConfig>;
}
