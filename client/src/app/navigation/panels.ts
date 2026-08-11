import type { SidebarPanelName } from '@/shared/ui/components/SidebarPanel';

export const panelFor = (pathname: string): SidebarPanelName => {
    if (pathname.startsWith('/dashboard/settings')) {
        return 'settings';
    }

    return 'app';
};
