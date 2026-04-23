import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { TextSize, TextWeight, TextTone } from './types';

const sizeMap: Record<TextSize, string> = {
    xs: 'font-size-05',
    sm: 'font-size-1',
    md: 'font-size-2',
    lg: 'font-size-3',
    xl: 'font-size-4',
    '2xl': 'font-size-5',
    '3xl': 'font-size-6'
};

const weightMap: Record<TextWeight, string> = {
    regular: 'font-weight-4',
    medium: 'font-weight-5',
    semibold: 'font-weight-5-5',
    bold: 'font-weight-6'
};

const toneMap: Record<TextTone, string> = {
    primary: 'color-primary',
    secondary: 'color-secondary',
    muted: 'color-muted',
    'muted-foreground': 'color-muted-foreground'
};

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

    const classes = cn(
        sizeMap[size],
        weightMap[weight],
        toneMap[tone],
        truncate ? 'text-truncate' : undefined,
        className
    );

    return (
        <Component ref={ref} className={classes} {...rest}>
            {children}
        </Component>
    );
});

Heading.displayName = 'Heading';

export default Heading;
