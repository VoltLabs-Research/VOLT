import type { SidebarPanelName } from '@/shared/ui/components/SidebarPanel';

/*
 * Which panel owns the left rail for a route. Settings and the AI workspace each
 * replace the app nav with their own list rather than nesting inside it.
 */
export const panelFor = (pathname: string): SidebarPanelName => {
    if (pathname.startsWith('/dashboard/settings')) {
        return 'settings';
    }

    if (pathname.startsWith('/dashboard/ai')) {
        return 'ai';
    }

    return 'app';
};
