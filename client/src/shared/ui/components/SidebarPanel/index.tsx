import { useFocusOnActivate } from '@/shared/ui/hooks/use-focus-on-activate';
import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

export type SidebarPanelName = 'app' | 'settings' | 'ai';

interface SidebarPanelProps {
    name: SidebarPanelName;
    label: string;
    active: boolean;
    children: ReactNode;
}

const SidebarPanel = ({ name, label, active, children }: SidebarPanelProps) => {
    const panel = useFocusOnActivate<HTMLElement>(active);

    return (
        <nav
            ref={panel}
            inert={!active}
            aria-label={label}
            data-state={active ? 'active' : 'idle'}
            className={cn(
                'sidebar-panel flex min-h-0 flex-col gap-0.5 overflow-x-hidden overflow-y-auto',
                {
                    app: 'sidebar-panel--app',
                    settings: 'sidebar-panel--settings',
                    ai: 'sidebar-panel--ai'
                }[name]
            )}
        >
            {children}
        </nav>
    );
};

export default SidebarPanel;
