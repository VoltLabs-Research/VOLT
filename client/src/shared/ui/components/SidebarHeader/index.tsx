import { Button } from '@heroui/react';
import { PanelRight } from 'lucide-react';

interface SidebarHeaderProps {
    collapsed?: boolean;
    /**
     * Set by Sidebar when the viewport is under the mobile breakpoint. The collapsed
     * header used to tighten its padding and drop its content through a
     * `@media (max-width: 768px)` block; that condition is the same one Sidebar
     * already resolves with `useMedia`, so it is passed down rather than measured twice.
     */
    isMobile?: boolean;
    onToggle?: () => void;
    controlsId?: string;
    children: React.ReactNode;
};

const HEADER = 'flex';
const HEADER_EXPANDED = 'justify-between p-6';
const HEADER_COLLAPSED = 'justify-start border-b border-border p-4 text-center';
const HEADER_COLLAPSED_MOBILE = 'justify-start border-b border-border p-3 text-center';

const TOGGLE = 'z-[5] min-h-11 min-w-11 shrink-0 rounded-full bg-surface-tertiary text-muted hover:border-border-secondary hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground';
const TOGGLE_ICON = 'size-5 transition-transform duration-200 ease-smooth';

const collapsedHeaderClass = (isMobile: boolean): string => (
    isMobile ? HEADER_COLLAPSED_MOBILE : HEADER_COLLAPSED
);

const SidebarHeader = ({ collapsed, isMobile = false, onToggle, controlsId, children }: SidebarHeaderProps) => {
    const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

    return (
        <header className={`${HEADER} ${collapsed ? collapsedHeaderClass(isMobile) : HEADER_EXPANDED}`}>
            <div className={collapsed && isMobile ? 'hidden' : 'flex flex-col gap-2'}>
                {children}
            </div>

            <Button
                variant='outline'
                isIconOnly
                size='sm'
                aria-label={label}
                aria-controls={controlsId}
                aria-expanded={collapsed === undefined ? undefined : !collapsed}
                onPress={onToggle}
                className={TOGGLE}
            >
                <PanelRight
                    className={collapsed ? `${TOGGLE_ICON} rotate-180` : TOGGLE_ICON}
                    aria-hidden='true'
                />
            </Button>
        </header>
    );
};

export default SidebarHeader;
