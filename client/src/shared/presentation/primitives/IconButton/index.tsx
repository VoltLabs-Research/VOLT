import './IconButton.css';
import { Children, forwardRef, useRef } from 'react';
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';

const MISSING_ICON_BUTTON_LABEL_ERROR = 'IconButton requires an accessible name via aria-label, aria-labelledby, or title.';
const FALLBACK_ICON_BUTTON_LABEL = 'Icon button';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
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
    'aria-labelledby': ariaLabelledBy,
    onClick,
    ...props
}, ref) => {
    const hasWarnedForMissingLabelRef = useRef(false);
    const textContent = Children.toArray(children)
        .filter((child): child is string | number => typeof child === 'string' || typeof child === 'number')
        .join(' ')
        .trim();
    const resolvedTitle = title?.trim() || undefined;
    const labelledBy = ariaLabelledBy?.trim() || undefined;

    let resolvedAriaLabel = ariaLabel?.trim() || resolvedTitle || textContent || undefined;
    if (!labelledBy && !resolvedAriaLabel) {
        if (!hasWarnedForMissingLabelRef.current) {
            console.warn(MISSING_ICON_BUTTON_LABEL_ERROR);
            hasWarnedForMissingLabelRef.current = true;
        }

        resolvedAriaLabel = FALLBACK_ICON_BUTTON_LABEL;
    }

    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (disabled) {
            event.preventDefault();
            return;
        }

        onClick?.(event);
    };

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
            title={resolvedTitle ?? resolvedAriaLabel}
            aria-label={resolvedAriaLabel}
            aria-labelledby={labelledBy}
            onClick={handleClick}
            {...props}
        >
            {children}
        </button>
    );
});

IconButton.displayName = 'IconButton';

export default IconButton;
