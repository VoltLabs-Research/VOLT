import { cn } from '@/shared/utils/cn';
import Surface from '../Surface';
import './Card.css';
import { forwardRef, useRef } from 'react';
import type {
    ElementType,
    HTMLAttributes,
    KeyboardEvent,
    ReactNode,
    Ref
} from 'react';
import type { SurfaceVariant } from '../types';

const MISSING_INTERACTIVE_NAME_ERROR =
    'Card with `interactive` requires an accessible name via aria-label or aria-labelledby.';

export type CardVariant = 'elevated' | 'glass' | 'plain';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Maps a {@link CardVariant} to the background-only `Surface` variant that
 * supplies its background/border/shadow. `plain` has no Surface variant — the
 * flat `.volt-card--plain` rules cover it.
 */
const SURFACE_VARIANT: Record<CardVariant, SurfaceVariant | undefined> = {
    elevated: 'elevated',
    glass: 'glass',
    plain: undefined
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    /** Background/elevation treatment. Defaults to `elevated`. */
    variant?: CardVariant;
    /**
     * Makes the whole card clickable/focusable. Renders a `<button>` (unless
     * `as`/`to` overrides the element) with keyboard activation. Requires an
     * accessible name.
     */
    interactive?: boolean;
    /** Applies the brand selected ring + `aria-selected` when interactive. */
    selected?: boolean;
    /**
     * Convenience body padding applied directly to the root. Prefer
     * `Card.Header`/`Card.Body`/`Card.Footer` slots for structured content;
     * use this for simple single-region cards. Defaults to `none`.
     */
    padding?: CardPadding;
    /** Element/component to render as. Defaults to `button` when interactive, else `div`. */
    as?: ElementType;
    children?: ReactNode;
    className?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
    variant = 'elevated',
    interactive = false,
    selected = false,
    padding = 'none',
    as,
    className,
    children,
    onKeyDown,
    role,
    tabIndex,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);

    const Component: ElementType = as ?? (interactive ? 'button' : 'div');
    const isNativeButton = interactive && Component === 'button';

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;

    if (interactive && !resolvedAriaLabel && !resolvedAriaLabelledBy) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_INTERACTIVE_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    const classes = cn(
        'volt-card',
        `volt-card--${variant}`,
        interactive && 'volt-card--interactive',
        selected && 'volt-card--selected',
        padding !== 'none' && `volt-card--pad-${padding}`,
        className
    );

    // Non-native interactive elements (e.g. `as='div'`/`as={Link}`) need an
    // explicit button role + keyboard activation to stay accessible.
    const needsButtonSemantics = interactive && !isNativeButton;

    const handleKeyDown = needsButtonSemantics
        ? (event: KeyboardEvent<HTMLDivElement>) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                (event.currentTarget as HTMLElement).click();
            }
        }
        : onKeyDown;

    const interactiveProps = interactive
        ? {
            role: needsButtonSemantics ? (role ?? 'button') : role,
            tabIndex: needsButtonSemantics ? (tabIndex ?? 0) : tabIndex,
            ...(isNativeButton ? { type: 'button' as const } : {}),
            'aria-label': resolvedAriaLabel,
            'aria-labelledby': resolvedAriaLabelledBy,
            'aria-selected': selected || undefined,
            onKeyDown: handleKeyDown
        }
        : {
            role,
            tabIndex,
            'aria-label': resolvedAriaLabel,
            'aria-labelledby': resolvedAriaLabelledBy,
            onKeyDown
        };

    return (
        <Surface
            ref={ref as Ref<HTMLElement>}
            as={Component}
            variant={SURFACE_VARIANT[variant]}
            className={classes}
            {...interactiveProps}
            {...rest}
        >
            {children}
        </Surface>
    );
});

Card.displayName = 'Card';

/* Slots ----------------------------------------------------------------- */

export interface CardSlotProps extends HTMLAttributes<HTMLDivElement> {
    as?: ElementType;
    children?: ReactNode;
    className?: string;
}

export interface CardBodyProps extends CardSlotProps {
    /** Body padding. Defaults to `md`. Use `none` to pad children manually. */
    padding?: CardPadding;
}

const CardHeader = forwardRef<HTMLDivElement, CardSlotProps>(({
    as,
    className,
    children,
    ...rest
}, ref) => {
    const Component = (as ?? 'div') as ElementType;
    return (
        <Component
            ref={ref as Ref<HTMLElement>}
            className={cn('volt-card__header', 'panel-header-bordered', className)}
            {...rest}
        >
            {children}
        </Component>
    );
});

CardHeader.displayName = 'Card.Header';

const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(({
    as,
    padding = 'md',
    className,
    children,
    ...rest
}, ref) => {
    const Component = (as ?? 'div') as ElementType;
    return (
        <Component
            ref={ref as Ref<HTMLElement>}
            className={cn(
                'volt-card__body',
                padding !== 'none' && `volt-card__body--pad-${padding}`,
                className
            )}
            {...rest}
        >
            {children}
        </Component>
    );
});

CardBody.displayName = 'Card.Body';

const CardFooter = forwardRef<HTMLDivElement, CardSlotProps>(({
    as,
    className,
    children,
    ...rest
}, ref) => {
    const Component = (as ?? 'div') as ElementType;
    return (
        <Component
            ref={ref as Ref<HTMLElement>}
            className={cn('volt-card__footer', 'panel-footer-bordered', className)}
            {...rest}
        >
            {children}
        </Component>
    );
});

CardFooter.displayName = 'Card.Footer';

type CardComponent = typeof Card & {
    Header: typeof CardHeader;
    Body: typeof CardBody;
    Footer: typeof CardFooter;
};

const CardWithSlots = Card as CardComponent;
CardWithSlots.Header = CardHeader;
CardWithSlots.Body = CardBody;
CardWithSlots.Footer = CardFooter;

export { CardHeader, CardBody, CardFooter };
export default CardWithSlots;
