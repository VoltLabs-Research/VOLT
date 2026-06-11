import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type StoragePlacement from '@modules/cluster/domain/entities/StoragePlacement';
import type { StoragePlacementProps } from '@modules/cluster/domain/entities/StoragePlacement';

export interface IStoragePlacementRepository extends IBaseRepository<StoragePlacement, StoragePlacementProps> {
    findByScope(scopeType: StoragePlacementProps['scopeType'], scopeId: string): Promise<StoragePlacement | null>;
    upsertByScope(
        scopeType: StoragePlacementProps['scopeType'],
        scopeId: string,
        data: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement>;
    listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>;
}
