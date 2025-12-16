import React, { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Visual style of the button
     * @default 'solid'
     */
    variant?: 'solid' | 'soft' | 'outline' | 'ghost';

    /**
     * Color theme/intent of the button
     * @default 'neutral'
     */
    intent?: 'neutral' | 'brand' | 'danger' | 'success' | 'white';

    /**
     * Size of the button
     * @default 'md'
     */
    size?: 'sm' | 'md' | 'lg' | 'xl';

    /**
     * Border radius shape
     * @default 'rounded'
     */
    shape?: 'rounded' | 'pill' | 'square' | 'circle';

    /**
     * Width 100%
     * @default false
     */
    block?: boolean;

    /**
     * Content alignment
     * @default 'center'
     */
    align?: 'start' | 'center' | 'end';

    /**
     * Loading state
     * @default false
     */
    isLoading?: boolean;

    /**
     * Navigation target (uses useNavigate)
     */
    to?: string;

    /**
     * Left icon
     */
    leftIcon?: React.ReactNode;

    /**
     * Right icon
     */
    rightIcon?: React.ReactNode;

    /**
     * Icon-only mode - renders just the icon without text
     * Uses the `children` as the icon content
     * @default false
     */
    iconOnly?: boolean;

    /**
     * Custom icon size when iconOnly is true
     */
    iconSize?: number;

    /**
     * Premium gradient style (for CTA buttons like empty-state)
     * @default false
     */
    premium?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    className = '',
    variant = 'solid',
    intent = 'neutral',
    size = 'md',
    shape = 'rounded',
    block = false,
    align = 'center',
    isLoading = false,
    to,
    disabled,
    leftIcon,
    rightIcon,
    iconOnly = false,
    iconSize,
    premium = false,
    children,
    onClick,
    type = 'button',
    ...props
}, ref) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading || disabled) {
            e.preventDefault();
            return;
        }

        if (onClick) {
            onClick(e);
        }

        if (to) {
            navigate(to);
        }
    };

    const classes = [
        'button',
        `variant-${variant}`,
        `intent-${intent}`,
        `size-${size}`,
        `shape-${shape}`,
        block ? 'block' : '',
        align !== 'center' ? `align-${align}` : '',
        isLoading ? 'is-loading' : '',
        iconOnly ? 'icon-only' : '',
        premium ? 'premium' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            disabled={disabled || isLoading}
            onClick={handleClick}
            {...props}
        >
            {isLoading && (
                <div className="button-loader">
                    <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 18} />
                </div>
            )}

            {leftIcon && <span className="button-icon-left">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="button-icon-right">{rightIcon}</span>}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
