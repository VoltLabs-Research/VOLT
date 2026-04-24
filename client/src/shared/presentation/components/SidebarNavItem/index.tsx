import Button from '@/shared/presentation/primitives/Button';
import './SidebarNavItem.css';
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';

interface SidebarNavItemProps {
    label: string;
    icon: IconType | LucideIcon;
    isSelected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    commandFor?: string;
    command?: string;
};

const SidebarNavItem = forwardRef<HTMLButtonElement, SidebarNavItemProps>(({ 
    label, 
    icon: Icon, 
    isSelected = false, 
    disabled = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
    commandFor,
    command
}, ref) => {
    return (
        <Button
            ref={ref}
            variant='ghost'
            intent='neutral'
            className={`sidebar-nav-item ${isSelected ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer transition-fast`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            disabled={disabled}
            aria-current={isSelected ? 'page' : undefined}
            {...(commandFor ? { commandfor: commandFor } : {})}
            {...(command ? { command } : {})}
        >
            <div className='sidebar-nav-icon font-size-4'>
                <Icon />
            </div>
            <span className='sidebar-nav-label'>{label}</span>
        </Button>
    );
});

SidebarNavItem.displayName = 'SidebarNavItem';

export default SidebarNavItem;
