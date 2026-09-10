import { useOutletContext } from 'react-router-dom';
import type { DashboardGlobalSearchBreadcrumb, DashboardHeaderContext } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { useEffect } from 'react';

interface UseDashboardHeaderContentOptions {
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
}

const useDashboardHeaderContent = ({
    globalSearchBreadcrumb
}: UseDashboardHeaderContentOptions) => {
    const { setGlobalSearchBreadcrumb } = useOutletContext<DashboardHeaderContext>();

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
