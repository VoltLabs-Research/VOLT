import { Button, cn } from '@heroui/react';
import { PanelRight } from 'lucide-react';

interface SidebarHeaderProps {
    collapsed?: boolean;

    isMobile?: boolean;
    onToggle?: () => void;
    controlsId?: string;
    children: React.ReactNode;
};

const SidebarHeader = ({ collapsed, isMobile = false, onToggle, controlsId, children }: SidebarHeaderProps) => {
    const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

    return (
        <header
            className={cn(
                'flex',
                !collapsed && 'items-center justify-between gap-1.5 pt-3.5 pr-3.5 pb-2 pl-2.5',
                collapsed && !isMobile && 'justify-center p-4',
                collapsed && isMobile && 'justify-center p-3'
            )}
        >
            {/* The rail is too narrow for the slot's content; only the toggle stays, so the sidebar can always be reopened. */}
            <div className={collapsed ? 'hidden' : 'flex min-w-0 flex-col gap-2'}>
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
                className='z-[5] shrink-0 rounded-full bg-transparent text-muted hover:bg-foreground/6 hover:text-foreground focus-visible:text-foreground'
            >
                <PanelRight
                    className={cn('size-4.5 transition-transform duration-200 ease-[var(--ease-emphasized)]', collapsed && 'rotate-180')}
                    aria-hidden='true'
                />
            </Button>
        </header>
    );
};

export default SidebarHeader;
