export const DASHBOARD_LAYOUT_EVENTS = {
    requestSidebarCollapse: 'volt:request-sidebar-collapse',
    requestSidebarExpand: 'volt:request-sidebar-expand',
    requestHeaderHide: 'volt:request-header-hide',
    requestHeaderShow: 'volt:request-header-show',
    workspaceChromeChanged: 'volt:workspace-chrome-changed'
} as const;

interface DashboardWorkspaceChromeOptions {
    collapseSidebar?: boolean;
    hideHeader?: boolean;
}

interface DashboardWorkspaceChromeRegistryEntry {
    collapseSidebar: boolean;
    hideHeader: boolean;
}

interface DashboardWorkspaceChromeRegistry {
    entries: Record<string, DashboardWorkspaceChromeRegistryEntry>;
}

export interface DashboardWorkspaceChromeState {
    sidebarCollapsed: boolean;
    headerHidden: boolean;
}

type DashboardWorkspaceChromeListener = () => void;

declare global {
    interface Window {
        __voltDashboardWorkspaceChrome?: DashboardWorkspaceChromeRegistry;
    }
}

const serverDashboardWorkspaceChromeRegistry: DashboardWorkspaceChromeRegistry = {
    entries: {}
};

const dashboardWorkspaceChromeListeners = new Set<DashboardWorkspaceChromeListener>();

const buildDashboardWorkspaceChromeState = (): DashboardWorkspaceChromeState => {
    const entries = Object.values(getDashboardWorkspaceChromeRegistry().entries);

    return {
        sidebarCollapsed: entries.some((entry) => entry.collapseSidebar),
        headerHidden: entries.some((entry) => entry.hideHeader)
    };
};

const getDashboardWorkspaceChromeRegistry = (): DashboardWorkspaceChromeRegistry => {
    if (typeof window === 'undefined') {
        return serverDashboardWorkspaceChromeRegistry;
    }

    if (!window.__voltDashboardWorkspaceChrome) {
        window.__voltDashboardWorkspaceChrome = {
            entries: {}
        };
    }

    return window.__voltDashboardWorkspaceChrome;
};

let dashboardWorkspaceChromeStateSnapshot = buildDashboardWorkspaceChromeState();

const dispatchDashboardWorkspaceChromeChange = (): void => {
    dashboardWorkspaceChromeStateSnapshot = buildDashboardWorkspaceChromeState();
    dashboardWorkspaceChromeListeners.forEach((listener) => listener());

    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.workspaceChromeChanged, {
        detail: getDashboardWorkspaceChromeState()
    }));
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
    const registry = getDashboardWorkspaceChromeRegistry();

    registry.entries[registrationId] = {
        collapseSidebar: Boolean(options.collapseSidebar),
        hideHeader: Boolean(options.hideHeader)
    };

    dispatchDashboardWorkspaceChromeChange();
};

export const unregisterDashboardWorkspaceChrome = (registrationId: string): void => {
    const registry = getDashboardWorkspaceChromeRegistry();

    if (!registry.entries[registrationId]) {
        return;
    }

    delete registry.entries[registrationId];
    dispatchDashboardWorkspaceChromeChange();
};
