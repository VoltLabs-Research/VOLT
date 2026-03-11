import useDashboardHeaderContext from '@/modules/dashboard/hooks/use-dashboard-header-context';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { useEffect } from 'react';

interface UseDashboardHeaderContentOptions {
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
};

const useDashboardHeaderContent = ({
    globalSearchBreadcrumb
}: UseDashboardHeaderContentOptions) => {
    const { setGlobalSearchBreadcrumb } = useDashboardHeaderContext();

    useEffect(() => {
        if (globalSearchBreadcrumb === undefined) {
            return;
        }

        setGlobalSearchBreadcrumb(globalSearchBreadcrumb ?? null);

        return () => {
            setGlobalSearchBreadcrumb(null);
        };
    }, [globalSearchBreadcrumb, setGlobalSearchBreadcrumb]);
};

export default useDashboardHeaderContent;
