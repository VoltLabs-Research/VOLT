import { cn } from '@/shared/utils/cn';
import './Checkbox.css';
import Text from '../Text';
import { Check, Minus } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef } from 'react';
import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';

const MISSING_CHECKBOX_NAME_ERROR = 'Checkbox requires an accessible name via the `label` prop, `aria-label`, `aria-labelledby`, or an external label bound to its id.';

export type CheckboxSize = 'sm' | 'md' | 'lg';

type NativeCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>;

export interface CheckboxProps extends NativeCheckboxProps {
    /** Controlled checked state. */
    checked?: boolean;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    /** Inline text label rendered after the box and wired to the input. */
    label?: ReactNode;
    /** Renders the mixed (—) state. Maps to the input's `indeterminate` property. */
    indeterminate?: boolean;
    disabled?: boolean;
    size?: CheckboxSize;
    className?: string;
    /** Class applied to the outer wrapper `<label>`. */
    containerClassName?: string;
}

/**
 * Accessible custom-styled checkbox built on a real `<input type="checkbox">`.
 * The native input is visually hidden but remains the source of truth for state,
 * keyboard interaction (Space toggles), and assistive tech. The brand-tinted box
 * is purely presentational (`aria-hidden`).
 *
 * `--color-brand-primary` fills the checked box; `--color-on-accent` colors the check.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
    checked,
    onChange,
    label,
    indeterminate = false,
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
    const innerRef = useRef<HTMLInputElement | null>(null);
    const hasWarnedForMissingNameRef = useRef(false);
    const reactId = useId();
    const inputId = id ?? `volt-checkbox-${reactId}`;

    // The `indeterminate` flag only exists as a DOM property, never an attribute.
    useEffect(() => {
        if (innerRef.current) {
            innerRef.current.indeterminate = indeterminate;
        }
    }, [indeterminate]);

    const setRefs = (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    const hasVisibleLabel = label != null && label !== '';
    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const resolvedTitle = title?.trim() || undefined;

    if (!hasVisibleLabel && !resolvedAriaLabel && !resolvedAriaLabelledBy && !resolvedTitle) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_CHECKBOX_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    return (
        <label
            htmlFor={inputId}
            className={cn(
                'volt-checkbox',
                `volt-checkbox--${size}`,
                checked && 'volt-checkbox--checked',
                indeterminate && 'volt-checkbox--indeterminate',
                disabled && 'volt-checkbox--disabled',
                containerClassName
            )}
            title={resolvedTitle}
        >
            <input
                ref={setRefs}
                id={inputId}
                type='checkbox'
                className={cn('volt-checkbox__input', className)}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                aria-checked={indeterminate ? 'mixed' : undefined}
                aria-label={!hasVisibleLabel ? resolvedAriaLabel : undefined}
                aria-labelledby={resolvedAriaLabelledBy}
                {...props}
            />
            <span className='volt-checkbox__box' aria-hidden='true'>
                {indeterminate ? (
                    <Minus className='volt-checkbox__indicator' strokeWidth={3} />
                ) : (
                    <Check className='volt-checkbox__indicator' strokeWidth={3} />
                )}
            </span>
            {hasVisibleLabel && (
                <Text as='span' size='sm' tone='primary' className='volt-checkbox__label'>
                    {label}
                </Text>
            )}
        </label>
    );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
