import React, { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import '@/shared/presentation/components/primitives/Button/Button.css';

export interface ButtonProps extends HTMLMotionProps<"button"> {
    variant?: 'solid' | 'soft' | 'outline' | 'ghost';
    children?: React.ReactNode;
    intent?: 'neutral' | 'brand' | 'danger' | 'success' | 'white';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    shape?: 'rounded' | 'pill' | 'square' | 'circle';
    block?: boolean;
    align?: 'start' | 'center' | 'end';
    isLoading?: boolean;
    to?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    iconOnly?: boolean;
    iconSize?: number;
    premium?: boolean;
    command?: string;
    commandfor?: string;
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
        className,
        'p-relative', 'items-center', 'content-center', 'font-weight-5', 'u-select-none', 'cursor-pointer'
    ].filter(Boolean).join(' ');

    return (
        <motion.button
            ref={ref}
            type={type}
            className={classes}
            disabled={disabled || isLoading}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={handleClick}
            {...props}
        >
            {isLoading && (
                <div className="button-loader p-absolute d-flex items-center content-center">
                    <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 18} />
                </div>
            )}

            {leftIcon && <span className="button-icon-left font-size-4">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="button-icon-right">{rightIcon}</span>}
        </motion.button>
    );
});

Button.displayName = 'Button';

export default Button;
