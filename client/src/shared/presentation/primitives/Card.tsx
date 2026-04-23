import { cn } from '@/shared/utils';
import { buildBoxClasses, splitBoxProps } from './buildBoxClasses';
import { forwardRef } from 'react';
import type { BoxStyleProps } from './buildBoxClasses';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';

export type CardVariant = 'soft' | 'elevated';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'>, BoxStyleProps {
    as?: ElementType;
    variant?: CardVariant;
    header?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    className?: string;
    contentClassName?: string;
}

/**
 * Bordered content container with optional header/footer slots. Default
 * `soft` variant = `b-soft radius-md p-1-5`. `elevated` = `card-elevated`.
 */
const Card = forwardRef<HTMLElement, CardProps>(({
    as,
    variant = 'soft',
    header,
    footer,
    className,
    contentClassName,
    children,
    ...props
}, ref) => {
    const Component = (as ?? 'div') as ElementType;
    const { styleProps, rest } = splitBoxProps(props);

    const hasSlots = Boolean(header || footer);

    const baseClasses = variant === 'elevated'
        ? ['card-elevated']
        : ['b-soft', 'radius-md'];

    const classes = cn(
        ...baseClasses,
        !hasSlots && 'p-1-5',
        ...buildBoxClasses(styleProps),
        className
    );

    if (!hasSlots) {
        return (
            <Component ref={ref as Ref<HTMLElement>} className={classes} {...rest}>
                {children}
            </Component>
        );
    }

    return (
        <Component ref={ref as Ref<HTMLElement>} className={classes} {...rest}>
            {header && (
                <div className='panel-header-bordered'>
                    {header}
                </div>
            )}
            <div className={cn('p-1-5', contentClassName)}>
                {children}
            </div>
            {footer && (
                <div className='panel-footer-bordered'>
                    {footer}
                </div>
            )}
        </Component>
    );
});

Card.displayName = 'Card';

export default Card;
