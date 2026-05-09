import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import service from '../api/service';

const KEYS = buildKeys<{
    rbacConfig: void;
}>('system');

export const rbacConfigQuery = createQuery(KEYS.rbacConfig, () => service.getRBACConfig({}));
