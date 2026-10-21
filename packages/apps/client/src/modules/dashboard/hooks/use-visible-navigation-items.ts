import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

const useVisibleNavigationItems = () => {
    const singleTenant = useSingleTenant();
    const inBrowser = localStackMode.isEnabled();

    return (items: DashboardNavigationItem[]): DashboardNavigationItem[] =>
        items.filter((item) => !(singleTenant && item.multiTenantOnly) && !(inBrowser && item.requiresMachine));
};

export default useVisibleNavigationItems;
