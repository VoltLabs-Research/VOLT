import { useFocusOnActivate } from './use-focus-on-activate';
import Scrollable from '@/shared/ui/components/Scrollable';
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
    const panel = useFocusOnActivate<HTMLDivElement>(active);

    return (
        <Scrollable
            ref={panel}
            role='navigation'
            inert={!active}
            aria-label={label}
            data-state={active ? 'active' : 'idle'}
            className={cn(
                'sidebar-panel flex min-h-0 flex-col gap-0.5 overflow-x-hidden',
                {
                    app: 'sidebar-panel--app',
                    settings: 'sidebar-panel--settings',
                    ai: 'sidebar-panel--ai'
                }[name]
            )}
        >
            {children}
        </Scrollable>
    );
};

export default SidebarPanel;
