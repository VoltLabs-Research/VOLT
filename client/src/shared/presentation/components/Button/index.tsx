import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import './Button.css';
import { Children, forwardRef, useRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ButtonStyles extends CSSProperties {
    '--button-icon-size'?: string;
};

const MISSING_ICON_ONLY_LABEL_ERROR = 'Button with iconOnly requires an accessible name via aria-label, title, or text children.';
const FALLBACK_ICON_ONLY_LABEL = 'Icon button';

const resolveAccessibleText = (value?: string): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue || undefined;
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>{
    /**
     * Visual style of the button
     * @default 'solid'
     */
    variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'toggle';

    children?: ReactNode;

    /**
     * Color theme/intent of the button
     * @default 'neutral'
     */
    intent?: 'neutral' | 'brand' | 'danger' | 'success' | 'white' | 'canvas';

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
     * Navigation target(uses useNavigate)
     */
    to?: string;

    /**
     * Left icon
     */
    leftIcon?: ReactNode;

    /**
     * Right icon
     */
    rightIcon?: ReactNode;

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
     * Premium gradient style(for CTA buttons like empty-state)
     * @default false
     */
    premium?: boolean;
};


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
    style,
    title,
    type = 'button',
    'aria-label': ariaLabel,
    ...props
}, ref) => {
    const navigate = useNavigate();
    const hasWarnedForMissingLabelRef = useRef(false);

    const textContent = Children.toArray(children)
        .filter((child): child is string | number => typeof child === 'string' || typeof child === 'number')
        .join(' ')
        .trim();

    const resolvedTextContent = textContent || undefined;
    const normalizedAriaLabel = resolveAccessibleText(ariaLabel);
    const normalizedTitle = resolveAccessibleText(title);

    let resolvedAriaLabel = normalizedAriaLabel;
    if (iconOnly && !resolvedAriaLabel) {
        resolvedAriaLabel = normalizedTitle ?? resolvedTextContent;
    }

    if (iconOnly && !resolvedAriaLabel) {
        if (!hasWarnedForMissingLabelRef.current) {
            console.warn(MISSING_ICON_ONLY_LABEL_ERROR);

            hasWarnedForMissingLabelRef.current = true;
        }

        resolvedAriaLabel = FALLBACK_ICON_ONLY_LABEL;
    }

    const resolvedStyle: ButtonStyles = {
        ...style,
        ...(iconSize ? { '--button-icon-size': `${iconSize}px` } : {})
    };

    const resolvedTitle = normalizedTitle ?? (iconOnly ? resolvedAriaLabel : undefined);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
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

    const classes = cn(
        'button',
        `variant-${variant}`,
        `intent-${intent}`,
        `size-${size}`,
        `shape-${shape}`,
        block && 'block',
        align !== 'center' && `align-${align}`,
        isLoading && 'is-loading',
        iconOnly && 'icon-only',
        premium && 'premium',
        'p-relative',
        'items-center',
        'content-center',
        'font-weight-5',
        'u-select-none',
        'cursor-pointer',
        'transition-fast',
        className
    );

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            disabled={disabled || isLoading}
            onClick={handleClick}
            title={resolvedTitle}
            aria-label={resolvedAriaLabel}
            aria-busy={isLoading || undefined}
            style={resolvedStyle}
            {...props}
        >
            {isLoading && (
                <Container className="button-loader p-absolute d-flex items-center content-center">
                    <Loader scale={0.6} isFixed={false} />
                </Container>
            )}

            {leftIcon && <span className="button-icon-left font-size-4" aria-hidden='true'>{leftIcon}</span>}
            {iconOnly ? (
                <span className='button-icon-only-content d-flex items-center content-center' aria-hidden='true'>
                    {children}
                </span>
            ) : children}
            {rightIcon && <span className="button-icon-right" aria-hidden='true'>{rightIcon}</span>}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
