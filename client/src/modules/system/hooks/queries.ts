import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import service from '../api/service';

const KEYS = buildKeys<{
    rbacConfig: void;
    deploymentConfig: void;
}>('system');

export const rbacConfigQuery = createQuery(KEYS.rbacConfig, () => service.getRBACConfig({}));
export const deploymentConfigQuery = createQuery(KEYS.deploymentConfig, () => service.getDeploymentConfig({}));
