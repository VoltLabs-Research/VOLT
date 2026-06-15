import { deploymentConfigQuery } from '@/modules/system/hooks/queries';

export const useEnabledModules = (): string[] | null => {
    return deploymentConfigQuery(undefined, { staleTime: Infinity }).data?.enabledModules ?? null;
};
