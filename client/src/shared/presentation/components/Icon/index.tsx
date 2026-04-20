/**
 * Icon — renders any Lucide (or Lucide-compatible) icon with Apple HIG strokeWidth rules.
 *
 * Usage:
 *   import { ChevronRight } from 'lucide-react';
 *   import Icon from '@/shared/presentation/components/Icon';
 *
 *   <Icon as={ChevronRight} size={16} />   // strokeWidth auto: 2
 *   <Icon as={ChevronRight} size={24} />   // strokeWidth auto: 1.75
 *   <Icon as={ChevronRight} size={14} strokeWidth={1.5} />  // explicit override
 *
 * Pass `aria-label` when the icon is meaningful on its own; otherwise it is
 * marked aria-hidden automatically.
 */
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

type IconComponent = LucideIcon | ComponentType<LucideProps>;

interface IconProps extends Omit<LucideProps, 'size' | 'strokeWidth'> {
    as: IconComponent;
    size?: number;
    /** Override the auto-computed stroke weight. Prefer leaving unset. */
    strokeWidth?: number;
}

const resolveStrokeWidth = (size: number): number => {
    if (size <= 14) return 2.25;
    if (size <= 19) return 2;
    if (size <= 27) return 1.75;
    return 1.5;
};

const Icon = ({ as: Component, size = 16, strokeWidth, ...rest }: IconProps) => {
    const resolvedStroke = strokeWidth ?? resolveStrokeWidth(size);
    return <Component size={size} strokeWidth={resolvedStroke} aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />;
};

export default Icon;
