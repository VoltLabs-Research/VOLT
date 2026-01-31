import React from 'react';
import Container from '@/shared/presentation/components/Container';
import './PopoverMenuItem.css';

interface PopoverMenuItemProps {
    icon?: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
};

const PopoverMenuItem: React.FC<PopoverMenuItemProps> = ({
    icon,
    label,
    onClick,
    variant = 'default',
    disabled = false
}) => {
    return (
        <Container
            className={`popover-menu-item ${variant === 'danger' ? 'danger' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : onClick}
        >
            {icon && <Container className='d-flex items-center content-center f-shrink-0'>{icon}</Container>}
            <Container className='flex-1'>{label}</Container>
        </Container>
    );
};

export default PopoverMenuItem;
