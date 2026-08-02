import type { DashboardWorkspaceChromeOptions } from '@/modules/dashboard/contracts/layout';

export const DASHBOARD_LAYOUT_EVENTS = {
    requestSidebarCollapse: 'volt:request-sidebar-collapse',
    requestSidebarExpand: 'volt:request-sidebar-expand'
} as const;

interface DashboardWorkspaceChromeRegistryEntry {
    collapseSidebar: boolean;
    hideHeader: boolean;
}

interface DashboardWorkspaceChromeState {
    sidebarCollapsed: boolean;
    headerHidden: boolean;
}

type DashboardWorkspaceChromeListener = () => void;

const dashboardWorkspaceChromeEntries = new Map<string, DashboardWorkspaceChromeRegistryEntry>();
const dashboardWorkspaceChromeListeners = new Set<DashboardWorkspaceChromeListener>();

const buildDashboardWorkspaceChromeState = (): DashboardWorkspaceChromeState => {
    const entries = [...dashboardWorkspaceChromeEntries.values()];

    return {
        sidebarCollapsed: entries.some((entry) => entry.collapseSidebar),
        headerHidden: entries.some((entry) => entry.hideHeader)
    };
};

let dashboardWorkspaceChromeStateSnapshot = buildDashboardWorkspaceChromeState();

const dispatchDashboardWorkspaceChromeChange = (): void => {
    dashboardWorkspaceChromeStateSnapshot = buildDashboardWorkspaceChromeState();
    dashboardWorkspaceChromeListeners.forEach((listener) => listener());
};

export const getDashboardWorkspaceChromeState = (): DashboardWorkspaceChromeState => {
    return dashboardWorkspaceChromeStateSnapshot;
};

export const subscribeToDashboardWorkspaceChromeState = (
    listener: DashboardWorkspaceChromeListener
): (() => void) => {
    dashboardWorkspaceChromeListeners.add(listener);

    return () => {
        dashboardWorkspaceChromeListeners.delete(listener);
    };
};

export const registerDashboardWorkspaceChrome = (
    registrationId: string,
    options: DashboardWorkspaceChromeOptions
): void => {
    dashboardWorkspaceChromeEntries.set(registrationId, {
        collapseSidebar: Boolean(options.collapseSidebar),
        hideHeader: Boolean(options.hideHeader)
    });

    dispatchDashboardWorkspaceChromeChange();
};

export const unregisterDashboardWorkspaceChrome = (registrationId: string): void => {
    if (!dashboardWorkspaceChromeEntries.delete(registrationId)) {
        return;
    }

    dispatchDashboardWorkspaceChromeChange();
};
