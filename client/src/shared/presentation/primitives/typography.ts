import { cn } from '@/shared/utils/cn';
import type { TextAlign, TextSize, TextTone, TextWeight } from './types';

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
    right: 'text-right'
};

interface TypographyClassOptions {
    size?: TextSize;
    weight?: TextWeight;
    tone?: TextTone;
    align?: TextAlign;
    truncate?: boolean;
    lineHeight?: '5';
    className?: string;
}

export const buildTypographyClasses = ({
    size,
    weight,
    tone,
    align,
    truncate,
    lineHeight,
    className
}: TypographyClassOptions): string => cn(
    size ? sizeMap[size] : undefined,
    weight ? weightMap[weight] : undefined,
    tone ? toneMap[tone] : undefined,
    align ? alignMap[align] : undefined,
    truncate ? 'text-truncate' : undefined,
    lineHeight ? `line-height-${lineHeight}` : undefined,
    className
);
