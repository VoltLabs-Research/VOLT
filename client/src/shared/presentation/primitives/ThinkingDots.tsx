import { cn } from '@/shared/utils/cn';
import './ThinkingDots.css';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export interface ThinkingDotsProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'role'> {
    label?: string;
    size?: 'sm' | 'md';
}

/**
 * Three-dot typing indicator (chat/AI "thinking" state).
 * Renders a visually-hidden label for assistive tech.
 */
const ThinkingDots = forwardRef<HTMLSpanElement, ThinkingDotsProps>(({
    label = 'Thinking',
    size = 'md',
    className,
    ...rest
}, ref) => {
    return (
        <span
            ref={ref}
            role='status'
            aria-live='polite'
            className={cn('volt-thinking-dots', `volt-thinking-dots--${size}`, className)}
            {...rest}
        >
            <span className='sr-only'>{label}</span>
            <span className='volt-thinking-dots__dot' aria-hidden='true' />
            <span className='volt-thinking-dots__dot' aria-hidden='true' />
            <span className='volt-thinking-dots__dot' aria-hidden='true' />
        </span>
    );
});

ThinkingDots.displayName = 'ThinkingDots';

export default ThinkingDots;
