import { cn } from '@/shared/utils/cn';
import Stack from '../Stack';
import Row from '../Row';
import Text from '../Text';
import SectionLabel from '../SectionLabel';
import Skeleton from '../Skeleton';
import './StatCard.css';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type StatCardTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type StatCardState = 'ready' | 'loading';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
    label: ReactNode;
    value?: ReactNode;
    unit?: ReactNode;
    icon?: ReactNode;
    trend?: ReactNode;
    footer?: ReactNode;
    tone?: StatCardTone;
    state?: StatCardState;
    tabular?: boolean;
    surface?: 'elevated' | 'soft';
}

/**
 * Metric/stat display card. Consolidates the hand-rolled stat-card JSX
 * used across dashboard, cluster metrics, container metrics and secret-key
 * usage panels.
 */
const StatCard = forwardRef<HTMLDivElement, StatCardProps>(({
    label,
    value,
    unit,
    icon,
    trend,
    footer,
    tone = 'neutral',
    state = 'ready',
    tabular = true,
    surface = 'soft',
    className,
    ...rest
}, ref) => {
    const classes = cn(
        'volt-stat-card',
        `volt-stat-card--tone-${tone}`,
        surface === 'elevated' ? 'card-elevated' : 'b-soft radius-md',
        'p-1-5',
        className
    );

    return (
        <Stack ref={ref} gap='075' className={classes} {...rest}>
            <Row gap='05' align='center'>
                {icon && (
                    <span className='volt-stat-card__icon' aria-hidden='true'>
                        {icon}
                    </span>
                )}
                <SectionLabel className='volt-stat-card__label'>{label}</SectionLabel>
            </Row>

            {state === 'loading' ? (
                <Skeleton variant='text' width='60%' height={28} animation='wave' />
            ) : (
                <Row gap='05' className={cn('items-baseline', tabular && 'tabular-nums')}>
                    {value !== undefined && value !== null && (
                        <Text as='span' size='3xl' weight='bold' tone='primary' className='volt-stat-card__value'>
                            {value}
                        </Text>
                    )}
                    {unit && (
                        <Text as='span' size='md' tone='muted' className='volt-stat-card__unit'>
                            {unit}
                        </Text>
                    )}
                    {trend && (
                        <span className='volt-stat-card__trend'>{trend}</span>
                    )}
                </Row>
            )}

            {footer && <div className='volt-stat-card__footer'>{footer}</div>}
        </Stack>
    );
});

StatCard.displayName = 'StatCard';

export default StatCard;
