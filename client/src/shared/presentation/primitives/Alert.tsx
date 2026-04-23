import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { AlertTone } from './types';

/**
 * Map alert tones to existing zone classes. `info`/`success` fall back to a
 * neutral-bordered box since no colored zone utility exists for them; callers
 * can still pass `className` for custom tinting.
 */
const toneMap: Record<AlertTone, string> = {
    info: 'b-soft',
    success: 'b-soft',
    warning: 'zone-warning',
    danger: 'zone-danger'
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'title'> {
    tone?: AlertTone;
    icon?: ReactNode;
    title?: ReactNode;
    children?: ReactNode;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({
    tone = 'info',
    icon,
    title,
    className,
    children,
    ...rest
}, ref) => {
    const needsPadding = tone !== 'warning';
    const classes = cn(
        toneMap[tone],
        needsPadding && 'p-075',
        tone !== 'warning' && 'radius-md',
        'd-flex',
        'items-start',
        'gap-05',
        className
    );

    return (
        <div
            ref={ref}
            role='alert'
            className={classes}
            {...rest}
        >
            {icon && (
                <span className='d-flex items-center content-center f-shrink-0' aria-hidden='true'>
                    {icon}
                </span>
            )}
            <div className='d-flex column gap-025 min-w-0 flex-1'>
                {title && (
                    <span className='font-size-2 font-weight-5 color-primary'>
                        {title}
                    </span>
                )}
                {children && (
                    <span className='font-size-1 color-secondary line-height-5'>
                        {children}
                    </span>
                )}
            </div>
        </div>
    );
});

Alert.displayName = 'Alert';

export default Alert;
