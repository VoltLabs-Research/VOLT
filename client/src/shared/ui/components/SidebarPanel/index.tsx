import { useFocusOnActivate } from '@/shared/ui/hooks/use-focus-on-activate';
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
        /*
         * The scroller is the panel itself rather than a wrapper inside it, for two reasons that
         * both live in index.css: `.sidebar-panel` carries `grid-area: 1 / 1` so every panel stacks
         * in one cell, and `.sidebar-panel > *:nth-child(n)` staggers the entrance of each item. An
         * inserted wrapper would take over the grid area and collapse all six stagger delays onto
         * itself. `role='navigation'` keeps this equivalent to the <nav> it replaces.
         */
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
