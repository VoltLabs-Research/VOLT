import { cn } from '@/shared/utils/cn';
import Row from '../Row';
import Text from '../Text';
import './Meter.css';
import { forwardRef, useId, useRef } from 'react';
import { STATUS_TONE_VARS } from '../types';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { StatusTone } from '../types';

const MISSING_METER_NAME_WARNING =
    'Meter requires an accessible name via `label`, `aria-label`, or `aria-labelledby`.';

interface MeterStyle extends CSSProperties {
    '--progress-fill'?: string;
    '--progress-value'?: string;
}

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    /** Measured value, between `min` and `max`. Clamped. */
    value: number;
    /** Lower bound of the range. @default 0 */
    min?: number;
    /** Upper bound of the range. @default 100 */
    max?: number;
    /** Semantic color of the fill. @default 'brand' */
    tone?: StatusTone;
    /** Inline leading label, also used as the accessible name. */
    label?: ReactNode;
    /** Render the value (formatted by `formatValue`) at the trailing edge. @default false */
    showValue?: boolean;
    /** Formats the trailing value text; defaults to the raw number. */
    formatValue?: (value: number, min: number, max: number) => ReactNode;
}

const clamp = (value: number, min: number, max: number): number => {
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

/**
 * Compact inline gauge for a known-range scalar (e.g. quota, utilization,
 * confidence). A `role="meter"` sibling of {@link default ProgressBar}: shares the
 * track/fill visual but expresses a measurement rather than task completion.
 */
const Meter = forwardRef<HTMLDivElement, MeterProps>(({
    value,
    min = 0,
    max = 100,
    tone = 'brand',
    label,
    showValue = false,
    formatValue,
    className,
    id,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);
    const generatedId = useId();
    const labelId = `${generatedId}-label`;

    const safeMax = max > min ? max : min + 1;
    const clamped = clamp(value, min, safeMax);
    const percent = ((clamped - min) / (safeMax - min)) * 100;

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const hasVisibleLabel = label !== undefined && label !== null && label !== false;
    const computedLabelledBy = resolvedAriaLabelledBy ?? (hasVisibleLabel ? labelId : undefined);

    if (!computedLabelledBy && !resolvedAriaLabel) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_METER_NAME_WARNING);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    const fill = tone === 'brand' ? 'var(--color-brand-primary)' : STATUS_TONE_VARS[tone].fg;

    const resolvedStyle: MeterStyle = {
        ...style,
        '--progress-fill': fill,
        '--progress-value': `${percent}%`
    };

    const formattedValue = formatValue ? formatValue(clamped, min, safeMax) : clamped;

    return (
        <Row
            align='center'
            gap='05'
            className={cn('volt-meter', className)}
        >
            {hasVisibleLabel && (
                <Text as='span' id={labelId} size='sm' tone='secondary' className='volt-meter-label'>
                    {label}
                </Text>
            )}

            <div
                ref={ref}
                id={id}
                role='meter'
                className='volt-meter-track'
                style={resolvedStyle}
                aria-label={resolvedAriaLabel}
                aria-labelledby={computedLabelledBy}
                aria-describedby={ariaDescribedBy}
                aria-valuemin={min}
                aria-valuemax={safeMax}
                aria-valuenow={clamped}
                {...rest}
            >
                <div className='volt-meter-fill' aria-hidden='true' />
            </div>

            {showValue && (
                <Text as='span' size='sm' tone='muted' className='volt-meter-value'>
                    {formattedValue}
                </Text>
            )}
        </Row>
    );
});

Meter.displayName = 'Meter';

export default Meter;
