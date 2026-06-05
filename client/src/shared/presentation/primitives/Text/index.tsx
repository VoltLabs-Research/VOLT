import { buildTypographyClasses } from '../typography';
import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';
import type { TextSize, TextWeight, TextTone, TextAlign } from '../types';

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

    const classes = buildTypographyClasses({ size, weight, tone, align, truncate, lineHeight, className });

    return (
        <Component ref={ref as Ref<HTMLElement>} className={classes} {...rest}>
            {children}
        </Component>
    );
});

Text.displayName = 'Text';

export default Text;
