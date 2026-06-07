import { cn } from '@/shared/utils/cn';
import Row from '../Row';
import Text from '../Text';
import './ProgressBar.css';
import { forwardRef, useId, useRef } from 'react';
import { STATUS_TONE_VARS } from '../types';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { StatusTone } from '../types';

const MISSING_PROGRESS_NAME_WARNING =
    'ProgressBar requires an accessible name via `label`, `aria-label`, or `aria-labelledby`.';

export type ProgressBarSize = 'sm' | 'md';

interface ProgressBarStyle extends CSSProperties {
    '--progress-fill'?: string;
    '--progress-value'?: string;
}

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    /** Completion in the range 0–100. Clamped. Ignored when `indeterminate`. */
    value?: number;
    /** Semantic color of the fill. @default 'brand' */
    tone?: StatusTone;
    /** Track / fill thickness. @default 'md' */
    size?: ProgressBarSize;
    /** Visible label rendered above the track and used as the accessible name. */
    label?: ReactNode;
    /** Render the numeric percentage next to the label. @default false */
    showValue?: boolean;
    /** Animate an undetermined-duration bar; drops `aria-valuenow`. @default false */
    indeterminate?: boolean;
}

const clampPercent = (value: number): number => {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
};

/**
 * Linear determinate (or indeterminate) progress indicator.
 *
 * Track uses `--color-surface-2/3`; the fill resolves from the {@link StatusTone}
 * via {@link STATUS_TONE_VARS}, defaulting to `--color-brand-primary`. Replaces the
 * hand-rolled bars in `ProcessingLoader` and `TrajectoryUploadProgressPanel`.
 */
const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(({
    value = 0,
    tone = 'brand',
    size = 'md',
    label,
    showValue = false,
    indeterminate = false,
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

    const percent = clampPercent(value);
    const rounded = Math.round(percent);

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const hasVisibleLabel = label !== undefined && label !== null && label !== false;

    // The visible label, when present, becomes the accessible name via aria-labelledby.
    const computedLabelledBy = resolvedAriaLabelledBy ?? (hasVisibleLabel ? labelId : undefined);

    if (!computedLabelledBy && !resolvedAriaLabel) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_PROGRESS_NAME_WARNING);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    const fill = tone === 'brand' ? 'var(--color-brand-primary)' : STATUS_TONE_VARS[tone].fg;

    const resolvedStyle: ProgressBarStyle = {
        ...style,
        '--progress-fill': fill,
        '--progress-value': `${percent}%`
    };

    const classes = cn(
        'volt-progress',
        `volt-progress--size-${size}`,
        indeterminate && 'volt-progress--indeterminate'
    );

    const showHeader = hasVisibleLabel || (showValue && !indeterminate);

    return (
        <div className={cn('volt-progress-root', className)}>
            {showHeader && (
                <Row justify='between' align='center' gap='05' className='volt-progress-header'>
                    {hasVisibleLabel
                        ? <Text as='span' id={labelId} size='sm' tone='secondary'>{label}</Text>
                        : <span />}
                    {showValue && !indeterminate && (
                        <Text as='span' size='sm' tone='muted' className='volt-progress-value'>
                            {rounded}%
                        </Text>
                    )}
                </Row>
            )}

            <div
                ref={ref}
                id={id}
                role='progressbar'
                className={classes}
                style={resolvedStyle}
                aria-label={resolvedAriaLabel}
                aria-labelledby={computedLabelledBy}
                aria-describedby={ariaDescribedBy}
                aria-valuemin={indeterminate ? undefined : 0}
                aria-valuemax={indeterminate ? undefined : 100}
                aria-valuenow={indeterminate ? undefined : rounded}
                aria-valuetext={indeterminate ? undefined : `${rounded}%`}
                aria-busy={indeterminate || undefined}
                {...rest}
            >
                <div className='volt-progress-fill' aria-hidden='true' />
            </div>
        </div>
    );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
