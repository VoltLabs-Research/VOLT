import { cn } from '@/shared/utils/cn';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface SectionLabelProps extends HTMLAttributes<HTMLSpanElement> {
    children?: ReactNode;
}

/**
 * Eyebrow / section label. Uppercase, letter-spaced, muted.
 * Replaces ad-hoc `text-uppercase` + `font-size-05` combos.
 */
const SectionLabel = forwardRef<HTMLSpanElement, SectionLabelProps>(({
    className,
    children,
    ...rest
}, ref) => {
    return (
        <span ref={ref} className={cn('text-eyebrow', className)} {...rest}>
            {children}
        </span>
    );
});

SectionLabel.displayName = 'SectionLabel';

export default SectionLabel;
