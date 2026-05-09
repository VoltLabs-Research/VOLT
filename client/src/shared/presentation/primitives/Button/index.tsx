import { cn } from '@/shared/utils/cn';
import Loader from '../Loader';
import './Button.css';
import { Children, forwardRef, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, CSSProperties, MouseEventHandler, ReactNode } from 'react';

interface ButtonStyles extends CSSProperties {
    '--button-icon-size'?: string;
};

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

const MISSING_ICON_ONLY_LABEL_ERROR = 'Button with iconOnly requires an accessible name via aria-label, title, or text children.';
const FALLBACK_ICON_ONLY_LABEL = 'Icon button';

export interface ButtonProps extends NativeButtonProps {
    variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'toggle';
    children?: ReactNode;
    intent?: 'neutral' | 'brand' | 'danger' | 'success' | 'white' | 'canvas';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    shape?: 'rounded' | 'pill' | 'square' | 'circle';
    block?: boolean;
    align?: 'start' | 'center' | 'end';
    isLoading?: boolean;
    to?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    iconOnly?: boolean;
    iconSize?: number;
    premium?: boolean;
    onClick?: MouseEventHandler<HTMLElement>;
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
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-controls': ariaControls,
    'aria-expanded': ariaExpanded,
    id,
    role,
    tabIndex,
    ...props
}, ref) => {
    const hasWarnedForMissingLabelRef = useRef(false);
    const isDisabled = disabled || isLoading;

    const textContent = Children.toArray(children)
        .filter((child): child is string | number => typeof child === 'string' || typeof child === 'number')
        .join(' ')
        .trim();

    const resolvedTextContent = textContent || undefined;
    const normalizedAriaLabel = ariaLabel?.trim() || undefined;
    const normalizedTitle = title?.trim() || undefined;

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

    const handleButtonClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (isDisabled) {
            event.preventDefault();
            return;
        }

        onClick?.(event);
    };

    const handleLinkClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
        if (isDisabled) {
            event.preventDefault();
            return;
        }

        onClick?.(event);
    };

    const content = (
        <>
            {isLoading && (
                <div className="button-loader p-absolute d-flex items-center content-center">
                    <Loader scale={0.6} isFixed={false} />
                </div>
            )}

            {leftIcon && <span className="button-icon-left font-size-4" aria-hidden='true'>{leftIcon}</span>}
            {iconOnly ? (
                <span className='button-icon-only-content d-flex items-center content-center' aria-hidden='true'>
                    {children}
                </span>
            ) : children}
            {rightIcon && <span className="button-icon-right" aria-hidden='true'>{rightIcon}</span>}
        </>
    );

    if (to) {
        return (
            <Link
                to={to}
                id={id}
                className={classes}
                role={role}
                onClick={handleLinkClick}
                title={resolvedTitle}
                aria-label={resolvedAriaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                aria-controls={ariaControls}
                aria-expanded={ariaExpanded}
                aria-busy={isLoading || undefined}
                aria-disabled={isDisabled || undefined}
                tabIndex={isDisabled ? -1 : tabIndex}
                style={resolvedStyle}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            disabled={isDisabled}
            onClick={handleButtonClick}
            title={resolvedTitle}
            aria-label={resolvedAriaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            aria-busy={isLoading || undefined}
            id={id}
            role={role}
            tabIndex={tabIndex}
            style={resolvedStyle}
            {...props}
        >
            {content}
        </button>
    );

});

Button.displayName = 'Button';

export default Button;
