import { useFocusOnActivate } from './use-focus-on-activate';
import Scrollable from '@/shared/ui/components/Scrollable';
import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

export type SidebarPanelName = 'app' | 'settings' | 'ai' | 'trajectories' | 'secret-keys';

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
            // The main panel leaves to the left; the others, which open from it, to the right.
            className={cn('sidebar-panel flex min-h-0 flex-col gap-0.5 overflow-x-hidden', name === 'app' && 'sidebar-panel--app')}
        >
            {children}
        </Scrollable>
    );
};

// A caption over a panel's own rows, under its Go back.
export const SidebarPanelTitle = ({ children }: { children: ReactNode }) => (
    <p className='px-2 pt-3 pb-1.5 text-xs text-muted'>{children}</p>
);

export default SidebarPanel;
