import './IconButton.css';
import { forwardRef } from 'react';
import React from 'react';

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
    title,
    'aria-label': ariaLabel,
    ...props
}, ref) => {
    const resolvedAriaLabel = !ariaLabel && title ? title : ariaLabel;
    const classes = [
        'volt-icon-button',
        'flex-center',
        'transition-fast',
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
            title={title}
            aria-label={resolvedAriaLabel}
            {...props}
        >
            {children}
        </button>
    );
});

IconButton.displayName = 'IconButton';

export default IconButton;
