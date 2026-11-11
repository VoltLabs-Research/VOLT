import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import service from '../api/service';
import type { SystemUpdateStatus } from '@volt/contracts/modules/system/domain';

const KEYS = buildKeys<{
    deploymentConfig: void;
    updateStatus: void;
}>('system');

export const deploymentConfigQuery = createQuery(KEYS.deploymentConfig, () => service.getDeploymentConfig({}));
export const updateStatusQuery = createQuery(KEYS.updateStatus, () => service.getUpdateStatus({}));

// Starts the server's update, and shows it as running from the answer on.
export const applySystemUpdate = async (): Promise<SystemUpdateStatus> => {
    const next = await service.applyUpdate({});
    updateStatusQuery.set(undefined, next);
    return next;
};
