import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

const useVisibleNavigationItems = () => {
    const singleTenant = useSingleTenant();

    return (items: DashboardNavigationItem[]): DashboardNavigationItem[] =>
        items.filter((item) => !(singleTenant && item.multiTenantOnly));
};

export default useVisibleNavigationItems;
