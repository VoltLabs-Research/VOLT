import { Button } from '@voltstack/bravais';
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
            className={`sidebar-nav-item ${isSelected ? 'is-selected' : ''} relative gap-3 w-full text-md font-normal text-secondary cursor-pointer transition-fast`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            disabled={disabled}
            aria-current={isSelected ? 'page' : undefined}
            {...(commandFor ? { commandfor: commandFor } : {})}
            {...(command ? { command } : {})}
        >
            <div className='sidebar-nav-icon text-xl'>
                <Icon size='1em' />
            </div>
            <span className='sidebar-nav-label'>{label}</span>
        </Button>
    );
});

SidebarNavItem.displayName = 'SidebarNavItem';

export default SidebarNavItem;
