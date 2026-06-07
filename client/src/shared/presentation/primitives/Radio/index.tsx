import { cn } from '@/shared/utils/cn';
import './Radio.css';
import Text from '../Text';
import { forwardRef, useId, useRef } from 'react';
import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';

const MISSING_RADIO_NAME_ERROR = 'Radio requires an accessible name via the `label` prop, `aria-label`, `aria-labelledby`, or an external label bound to its id.';

export type RadioSize = 'sm' | 'md' | 'lg';

type NativeRadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;

export interface RadioProps extends NativeRadioProps {
    /** Controlled checked state. */
    checked?: boolean;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    /** Inline text label rendered after the dot and wired to the input. */
    label?: ReactNode;
    /** Radio group name. Required for native single-selection within a group. */
    name?: string;
    /** Submitted value for this option. */
    value?: string;
    disabled?: boolean;
    size?: RadioSize;
    className?: string;
    /** Class applied to the outer wrapper `<label>`. */
    containerClassName?: string;
}

/**
 * Accessible custom-styled radio built on a real `<input type="radio">`.
 * The native input remains the source of truth for state, keyboard interaction
 * (arrow keys move within a `name` group), and assistive tech; the brand-tinted
 * circle is presentational (`aria-hidden`).
 *
 * `--color-brand-primary` fills the selected circle; `--color-on-accent` is the dot.
 */
const Radio = forwardRef<HTMLInputElement, RadioProps>(({
    checked,
    onChange,
    label,
    name,
    value,
    disabled = false,
    size = 'md',
    className,
    containerClassName,
    id,
    title,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);
    const reactId = useId();
    const inputId = id ?? `volt-radio-${reactId}`;

    const hasVisibleLabel = label != null && label !== '';
    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const resolvedTitle = title?.trim() || undefined;

    if (!hasVisibleLabel && !resolvedAriaLabel && !resolvedAriaLabelledBy && !resolvedTitle) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_RADIO_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    return (
        <label
            htmlFor={inputId}
            className={cn(
                'volt-radio',
                `volt-radio--${size}`,
                checked && 'volt-radio--checked',
                disabled && 'volt-radio--disabled',
                containerClassName
            )}
            title={resolvedTitle}
        >
            <input
                ref={ref}
                id={inputId}
                type='radio'
                className={cn('volt-radio__input', className)}
                checked={checked}
                onChange={onChange}
                name={name}
                value={value}
                disabled={disabled}
                aria-label={!hasVisibleLabel ? resolvedAriaLabel : undefined}
                aria-labelledby={resolvedAriaLabelledBy}
                {...props}
            />
            <span className='volt-radio__box' aria-hidden='true'>
                <span className='volt-radio__indicator' />
            </span>
            {hasVisibleLabel && (
                <Text as='span' size='sm' tone='primary' className='volt-radio__label'>
                    {label}
                </Text>
            )}
        </label>
    );
});

Radio.displayName = 'Radio';

export default Radio;
