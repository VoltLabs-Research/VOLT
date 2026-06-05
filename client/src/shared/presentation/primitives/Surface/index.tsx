import { cn } from '@/shared/utils/cn';
import { buildBoxClasses, splitBoxProps } from '../buildBoxClasses';
import { forwardRef } from 'react';
import type { BoxStyleProps } from '../buildBoxClasses';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';
import type { SurfaceVariant } from '../types';

const variantMap: Record<SurfaceVariant, string> = {
    primary: 'primary-surface',
    glass: 'glass-bg',
    elevated: 'card-elevated',
    danger: 'zone-danger',
    warning: 'zone-warning'
};

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLElement>, 'children'>, BoxStyleProps {
    as?: ElementType;
    variant?: SurfaceVariant;
    children?: ReactNode;
    className?: string;
}

const Surface = forwardRef<HTMLElement, SurfaceProps>(({
    as,
    variant,
    className,
    children,
    ...props
}, ref) => {
    const Component = (as ?? 'div') as ElementType;
    const { styleProps, rest } = splitBoxProps(props);

    const classes = cn(
        variant ? variantMap[variant] : undefined,
        ...buildBoxClasses(styleProps),
        className
    );

    return (
        <Component ref={ref as Ref<HTMLElement>} className={classes} {...rest}>
            {children}
        </Component>
    );
});

Surface.displayName = 'Surface';

export default Surface;
