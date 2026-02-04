import React from 'react';
import Button from '@/components/primitives/Button';

interface ButtonProps {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    icon?: any;
    className?: string;
}

const CanvasButton: React.FC<ButtonProps> = ({
    children,
    onClick,
    disabled = false,
    icon: Icon,
    className = ''
}) => {
    return (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            className={className}
            onClick={onClick}
            disabled={disabled}
            leftIcon={Icon ? <Icon /> : undefined}
        >
            {children}
        </Button>
    );
};

export default CanvasButton;
