import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import service from '../api/service';

const KEYS = buildKeys<{
    rbacConfig: void;
    deploymentConfig: void;
}>('system');

export const rbacConfigQuery = createQuery(KEYS.rbacConfig, () => service.getRBACConfig({}));
export const deploymentConfigQuery = createQuery(KEYS.deploymentConfig, () => service.getDeploymentConfig({}));
