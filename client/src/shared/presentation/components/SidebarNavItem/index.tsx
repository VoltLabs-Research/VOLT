import type { IconType } from 'react-icons';
import type { LucideIcon } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import './SidebarNavItem.css';

interface SidebarNavItemProps {
    label: string;
    icon: IconType | LucideIcon;
    isSelected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    commandFor?: string;
    command?: string;
};

const SidebarNavItem = ({ 
    label, 
    icon: Icon, 
    isSelected = false, 
    disabled = false,
    onClick,
    commandFor,
    command
}: SidebarNavItemProps) => {
    return (
        <Button
            variant='ghost'
            intent='neutral'
            className={`sidebar-nav-item ${isSelected ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer transition-fast`}
            onClick={onClick}
            disabled={disabled}
            {...(commandFor ? { commandfor: commandFor } : {})}
            {...(command ? { command } : {})}
        >
            <Container className='sidebar-nav-icon font-size-4'>
                <Icon />
            </Container>
            <span className='sidebar-nav-label'>{label}</span>
        </Button>
    );
};

export default SidebarNavItem;
