import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

/**
 * Filters navigation down to what this deployment offers.
 *
 * Every module ships in every build, so nothing is filtered by module any more —
 * the only thing that still hides an item is a single-tenant deployment, where
 * the team-management entries have nothing to manage.
 */
const useVisibleNavigationItems = () => {
    const singleTenant = useSingleTenant();

    return (items: DashboardNavigationItem[]): DashboardNavigationItem[] =>
        items.filter((item) => !(singleTenant && item.multiTenantOnly));
};

export default useVisibleNavigationItems;
