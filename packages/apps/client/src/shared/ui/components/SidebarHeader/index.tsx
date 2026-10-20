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
                !collapsed && 'justify-between p-6',
                collapsed && !isMobile && 'justify-start border-b border-border p-4 text-center',
                collapsed && isMobile && 'justify-start border-b border-border p-3 text-center'
            )}
        >
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
                className='z-[5] min-h-11 min-w-11 shrink-0 rounded-full bg-surface-tertiary text-muted hover:border-border-secondary hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground'
            >
                <PanelRight
                    className={cn('size-5 transition-transform duration-200 ease-smooth', collapsed && 'rotate-180')}
                    aria-hidden='true'
                />
            </Button>
        </header>
    );
};

export default SidebarHeader;
