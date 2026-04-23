import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';
import type { TextSize, TextWeight, TextTone, TextAlign } from './types';

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

const alignMap: Record<TextAlign, string> = {
    left: '',
    center: 'text-center',
    right: ''
};

export interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
    as?: 'span' | 'p' | 'div' | 'label' | 'small' | 'strong' | 'em' | 'li';
    size?: TextSize;
    weight?: TextWeight;
    tone?: TextTone;
    align?: TextAlign;
    truncate?: boolean;
    lineHeight?: '5';
    children?: ReactNode;
    className?: string;
}

const Text = forwardRef<HTMLElement, TextProps>(({
    as = 'span',
    size,
    weight,
    tone,
    align,
    truncate,
    lineHeight,
    className,
    children,
    ...rest
}, ref) => {
    const Component = as as ElementType;

    const classes = cn(
        size ? sizeMap[size] : undefined,
        weight ? weightMap[weight] : undefined,
        tone ? toneMap[tone] : undefined,
        align ? alignMap[align] : undefined,
        truncate ? 'text-truncate' : undefined,
        lineHeight ? `line-height-${lineHeight}` : undefined,
        className
    );

    return (
        <Component ref={ref as Ref<HTMLElement>} className={classes} {...rest}>
            {children}
        </Component>
    );
});

Text.displayName = 'Text';

export default Text;
