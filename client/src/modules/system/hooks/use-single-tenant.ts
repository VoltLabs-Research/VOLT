import { deploymentConfigQuery } from '@/modules/system/hooks/queries';

export const useSingleTenant = (): boolean => {
    return deploymentConfigQuery(undefined, { staleTime: Infinity }).data?.mode === 'local';
};
