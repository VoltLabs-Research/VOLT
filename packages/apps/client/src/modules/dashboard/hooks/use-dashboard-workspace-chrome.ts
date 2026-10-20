import {
    registerDashboardWorkspaceChrome,
    unregisterDashboardWorkspaceChrome
} from '@/modules/dashboard/utils/layout-events';
import type { DashboardWorkspaceChromeOptions } from '@/modules/dashboard/contracts/layout';
import { useId, useLayoutEffect } from 'react';

const useDashboardWorkspaceChrome = ({ hideHeader = false }: DashboardWorkspaceChromeOptions = {}): void => {
    const registrationId = useId();

    useLayoutEffect(() => {
        if (!hideHeader) {
            return;
        }

        registerDashboardWorkspaceChrome(registrationId, { hideHeader });

        return () => {
            unregisterDashboardWorkspaceChrome(registrationId);
        };
    }, [hideHeader, registrationId]);
};

export default useDashboardWorkspaceChrome;
