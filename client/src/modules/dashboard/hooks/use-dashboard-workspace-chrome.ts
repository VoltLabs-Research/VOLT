import {
    registerDashboardWorkspaceChrome,
    unregisterDashboardWorkspaceChrome
} from '@/modules/dashboard/utilities/layout-events';
import { useId, useLayoutEffect } from 'react';

interface DashboardWorkspaceChromeOptions {
    collapseSidebar?: boolean;
    hideHeader?: boolean;
};

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
