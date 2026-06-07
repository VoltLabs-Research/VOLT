import { cn } from '@/shared/utils/cn';
import TextInput from '../TextInput';
import IconButton from '../IconButton';
import './NumberInput.css';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { forwardRef, useCallback, useRef } from 'react';
import type { ChangeEventHandler } from 'react';
import type { TextInputProps } from '../TextInput';

export interface NumberInputProps extends Omit<TextInputProps, 'type' | 'value' | 'defaultValue' | 'onChange'> {
    min?: number;
    max?: number;
    /** Increment applied by the steppers and arrow keys. Defaults to 1. */
    step?: number;
    value?: number | '';
    defaultValue?: number;
    /** Native change passthrough (fires with the raw string event). */
    onChange?: ChangeEventHandler<HTMLInputElement>;
    /** Parsed-number callback; receives `NaN` when the field is cleared/invalid. */
    onValueChange?: (value: number) => void;
    /** Render the increment/decrement stepper buttons. */
    showSteppers?: boolean;
}

const clamp = (value: number, min?: number, max?: number): number => {
    let next = value;
    if (typeof min === 'number') next = Math.max(next, min);
    if (typeof max === 'number') next = Math.min(next, max);
    return next;
};

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(({
    min,
    max,
    step = 1,
    value,
    defaultValue,
    onChange,
    onValueChange,
    showSteppers = true,
    disabled,
    containerClassName,
    rightIcon,
    ...props
}, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);

    // Merge the forwarded ref with a local handle used to read/step the value.
    const setRefs = useCallback((node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    const emitValue = useCallback((next: number) => {
        onValueChange?.(next);
    }, [onValueChange]);

    const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
        onChange?.(event);
        const raw = event.target.value;
        emitValue(raw === '' ? Number.NaN : Number(raw));
    };

    const stepBy = useCallback((direction: 1 | -1) => {
        if (disabled) return;

        const current = (() => {
            if (typeof value === 'number') return value;
            const parsed = Number(innerRef.current?.value);
            return Number.isFinite(parsed) ? parsed : (min ?? 0);
        })();

        const next = clamp(current + direction * step, min, max);
        emitValue(next);

        // Keep the DOM in sync for uncontrolled usage.
        if (value === undefined && innerRef.current) {
            innerRef.current.value = String(next);
        }
    }, [disabled, value, min, max, step, emitValue]);

    const steppers = showSteppers ? (
        <span className='volt-number-input__steppers' aria-hidden='true'>
            <IconButton
                tabIndex={-1}
                aria-label='Increment value'
                className='volt-number-input__stepper'
                disabled={disabled || (typeof max === 'number' && typeof value === 'number' && value >= max)}
                onClick={() => stepBy(1)}
            >
                <ChevronUp />
            </IconButton>
            <IconButton
                tabIndex={-1}
                aria-label='Decrement value'
                className='volt-number-input__stepper'
                disabled={disabled || (typeof min === 'number' && typeof value === 'number' && value <= min)}
                onClick={() => stepBy(-1)}
            >
                <ChevronDown />
            </IconButton>
        </span>
    ) : null;

    return (
        <TextInput
            ref={setRefs}
            type='number'
            inputMode='decimal'
            min={min}
            max={max}
            step={step}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            onChange={handleChange}
            containerClassName={cn('volt-number-input', containerClassName)}
            rightIcon={steppers ?? rightIcon}
            {...props}
        />
    );
});

NumberInput.displayName = 'NumberInput';

export default NumberInput;
