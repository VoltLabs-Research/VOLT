import {
    registerDashboardWorkspaceChrome,
    unregisterDashboardWorkspaceChrome
} from '@/modules/dashboard/utils/layout-events';
import type { DashboardWorkspaceChromeOptions } from '@/modules/dashboard/contracts/layout';
import { useId, useLayoutEffect } from 'react';

const useDashboardWorkspaceChrome = ({
    collapseSidebar = false,
    hideHeader = false
}: DashboardWorkspaceChromeOptions = {}): void => {
    const registrationId = useId();

    useLayoutEffect(() => {
        if (!collapseSidebar && !hideHeader) {
            return;
        }

        registerDashboardWorkspaceChrome(registrationId, {
            collapseSidebar,
            hideHeader
        });

        return () => {
            unregisterDashboardWorkspaceChrome(registrationId);
        };
    }, [collapseSidebar, hideHeader, registrationId]);
};

export default useDashboardWorkspaceChrome;
