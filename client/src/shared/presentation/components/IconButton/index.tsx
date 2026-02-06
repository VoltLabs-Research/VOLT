import React, { forwardRef } from 'react';
import './IconButton.css';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'default' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({
    children,
    className = '',
    variant = 'default',
    size = 'md',
    disabled,
    ...props
}, ref) => {
    const classes = [
        'volt-icon-button',
        `volt-icon-button--${variant}`,
        `volt-icon-button--${size}`,
        disabled && 'volt-icon-button--disabled',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            ref={ref}
            className={classes}
            disabled={disabled}
            type='button'
            {...props}
        >
            {children}
        </button>
    );
});

IconButton.displayName = 'IconButton';

export default IconButton;
