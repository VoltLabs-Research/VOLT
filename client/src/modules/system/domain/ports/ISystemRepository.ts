import type { RBACConfig } from '../entities';

export default interface ISystemRepository {
    getRBACConfig(): Promise<RBACConfig>;
};
