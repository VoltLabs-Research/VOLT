import { buildTypographyClasses } from '../typography';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { TextSize, TextWeight, TextTone } from '../types';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> {
    level: HeadingLevel;
    size?: TextSize;
    weight?: TextWeight;
    tone?: TextTone;
    truncate?: boolean;
    children?: ReactNode;
    className?: string;
}

const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(({
    level,
    size = 'lg',
    weight = 'medium',
    tone = 'primary',
    truncate,
    className,
    children,
    ...rest
}, ref) => {
    const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

    const classes = buildTypographyClasses({ size, weight, tone, truncate, className });

    return (
        <Component ref={ref} className={classes} {...rest}>
            {children}
        </Component>
    );
});

Heading.displayName = 'Heading';

export default Heading;
