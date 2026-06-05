import { cn } from '@/shared/utils/cn';
import Row from '../Row';
import Text from '../Text';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type InlineStatusTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger';

const toneClass: Record<InlineStatusTone, string> = {
    neutral: 'color-primary',
    muted: 'color-muted',
    success: 'status-success',
    warning: 'status-warning',
    danger: 'status-error'
};

export interface InlineStatusProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    tone?: InlineStatusTone;
    icon?: ReactNode;
    live?: 'polite' | 'assertive' | 'off';
    severity?: 'status' | 'alert';
    children?: ReactNode;
}

/**
 * Inline live-region status/alert row (icon + message). Use for form-save
 * feedback, toast-lite inline messages, etc.
 */
const InlineStatus = forwardRef<HTMLDivElement, InlineStatusProps>(({
    tone = 'neutral',
    icon,
    live = 'polite',
    severity = 'status',
    className,
    children,
    ...rest
}, ref) => {
    const textTone = tone === 'muted' ? 'muted' : tone === 'neutral' ? 'secondary' : undefined;
    const inlineStyle = tone !== 'neutral' && tone !== 'muted'
        ? { color: `var(--${toneClass[tone]})` }
        : undefined;

    return (
        <Row
            ref={ref}
            gap='05'
            role={severity}
            aria-live={live}
            aria-atomic='true'
            className={cn('font-size-1', className)}
            style={inlineStyle}
            {...rest}
        >
            {icon && <span className='d-flex items-center' aria-hidden='true'>{icon}</span>}
            <Text as='span' size='sm' tone={textTone}>{children}</Text>
        </Row>
    );
});

InlineStatus.displayName = 'InlineStatus';

export default InlineStatus;
