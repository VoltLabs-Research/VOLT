import { useEnabledModules } from '@/modules/system/hooks/use-module-enabled';
import { useHiddenModules } from '@/modules/system/hooks/use-hidden-modules';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

const useVisibleNavigationItems = () => {
    const singleTenant = useSingleTenant();
    const enabledModules = useEnabledModules();
    const { hidden: hiddenModules } = useHiddenModules();

    return (items: DashboardNavigationItem[]): DashboardNavigationItem[] => {
        return items.filter((item) => {
            if (singleTenant && item.multiTenantOnly) {
                return false;
            }

            if (!item.moduleKey) {
                return true;
            }

            const serverEnabled = enabledModules === null || enabledModules.includes(item.moduleKey);

            return serverEnabled && !hiddenModules.includes(item.moduleKey);
        });
    };
};

export default useVisibleNavigationItems;
