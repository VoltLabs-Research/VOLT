import { cn } from '@/shared/utils/cn';
import './Timeline.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type TimelineTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface TimelineItemProps extends HTMLAttributes<HTMLLIElement> {
    icon?: ReactNode;
    tone?: TimelineTone;
    connector?: boolean;
    children?: ReactNode;
}

/** A single timeline entry — dot/icon column + content column. */
export const TimelineItem = forwardRef<HTMLLIElement, TimelineItemProps>(({
    icon,
    tone = 'neutral',
    connector = true,
    className,
    children,
    ...rest
}, ref) => {
    return (
        <li
            ref={ref}
            className={cn('volt-timeline-item', `volt-timeline-item--tone-${tone}`, className)}
            {...rest}
        >
            <span className='volt-timeline-item__rail' aria-hidden='true'>
                <span className='volt-timeline-item__dot'>{icon}</span>
                {connector && <span className='volt-timeline-item__line' />}
            </span>
            <div className='volt-timeline-item__content'>
                {children}
            </div>
        </li>
    );
});

TimelineItem.displayName = 'TimelineItem';

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
    children?: ReactNode;
}

/** Vertical timeline container. Children should be `TimelineItem` instances. */
const Timeline = forwardRef<HTMLOListElement, TimelineProps>(({
    className,
    children,
    ...rest
}, ref) => {
    return (
        <ol ref={ref} className={cn('volt-timeline', className)} {...rest}>
            {children}
        </ol>
    );
});

Timeline.displayName = 'Timeline';

export default Timeline;
