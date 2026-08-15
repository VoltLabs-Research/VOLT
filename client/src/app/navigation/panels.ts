import type { SidebarPanelName } from '@/shared/ui/components/SidebarPanel';

export const panelFor = (pathname: string): SidebarPanelName => {
    if (pathname.startsWith('/dashboard/settings')) {
        return 'settings';
    }

    if (pathname.startsWith('/dashboard/ai')) {
        return 'ai';
    }

    return 'app';
};
