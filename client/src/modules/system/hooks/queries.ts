import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import { getRBACConfig } from '../services/rbac-config';

const KEYS = buildKeys<{
    rbacConfig: void;
}>('system');

export const rbacConfigQuery = createQuery(KEYS.rbacConfig, getRBACConfig);
