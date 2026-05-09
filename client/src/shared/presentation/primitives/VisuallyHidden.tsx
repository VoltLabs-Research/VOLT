import { cn } from '@/shared/utils/cn';
import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
    as?: ElementType;
    children?: ReactNode;
}

/**
 * Screen-reader-only wrapper. Hides its children visually but keeps them
 * reachable by assistive technology. Maps to the `.sr-only` utility.
 */
const VisuallyHidden = forwardRef<HTMLElement, VisuallyHiddenProps>(({
    as,
    className,
    children,
    ...rest
}, ref) => {
    const Component = (as ?? 'span') as ElementType;
    return (
        <Component ref={ref as Ref<HTMLElement>} className={cn('sr-only', className)} {...rest}>
            {children}
        </Component>
    );
});

VisuallyHidden.displayName = 'VisuallyHidden';

export default VisuallyHidden;
