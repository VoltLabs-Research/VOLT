import React from 'react';

interface ButtonProps {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    icon?: any;
    className?: string;
}

const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    disabled = false,
    icon: Icon,
    className = ''
}) => {
    return (
        <button 
            className={className}
            onClick={onClick}
            disabled={disabled}
        >
            {Icon && <Icon />}
            {children}
        </button>
    );
};

export default Button;