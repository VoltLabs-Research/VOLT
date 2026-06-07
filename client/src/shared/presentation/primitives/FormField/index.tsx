import { cn } from '@/shared/utils/cn';
import './FormField.css';
import Stack from '../Stack';
import Text from '../Text';
import { forwardRef, useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export type FormFieldLayout = 'stacked' | 'inline';

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    /** Visible field label. Rendered as a `<label>` bound to `htmlFor` when present. */
    label?: ReactNode;
    /** Associates the label with the control it wraps (the control's `id`). */
    htmlFor?: string;
    /** Marks the field as required and renders a danger-toned asterisk after the label. */
    required?: boolean;
    /** Error message. When set, the field is described by a danger-toned message. */
    error?: ReactNode;
    /** Secondary helper text shown when there's no error. */
    helpText?: ReactNode;
    /** `stacked` (default) renders label above the control; `inline` uses a label-column grid. */
    layout?: FormFieldLayout;
    /** The control (input/select/checkbox/etc.) this field wraps. */
    children?: ReactNode;
    className?: string;
}

/**
 * Generic field wrapper that pairs a label and helper/error messaging with an
 * arbitrary control. Composes {@link Stack} + {@link Text}; carries no input
 * styling of its own so any control primitive can sit inside it.
 *
 * Accessibility: the label is a real `<label htmlFor>` when `htmlFor` is given,
 * and the helper/error text gets a stable id so callers can wire
 * `aria-describedby` on the control (exposed via the resolved id on the message).
 */
const FormField = forwardRef<HTMLDivElement, FormFieldProps>(({
    label,
    htmlFor,
    required = false,
    error,
    helpText,
    layout = 'stacked',
    children,
    className,
    id,
    ...rest
}, ref) => {
    const reactId = useId();
    const baseId = id ?? `volt-form-field-${reactId}`;
    const messageId = `${baseId}-message`;

    const hasLabel = label != null && label !== '';
    const hasError = error != null && error !== '';
    const hasHelp = !hasError && helpText != null && helpText !== '';
    const message = hasError ? error : helpText;
    const hasMessage = hasError || hasHelp;

    const labelText = (
        <Text as='span' size='sm' weight='medium' tone='secondary'>
            {label}
            {required && (
                <span className='volt-form-field__required' aria-hidden='true'>*</span>
            )}
        </Text>
    );

    const labelNode = hasLabel ? (
        htmlFor ? (
            <label htmlFor={htmlFor} className='volt-form-field__label'>
                {labelText}
            </label>
        ) : (
            <div className='volt-form-field__label'>{labelText}</div>
        )
    ) : null;

    const messageNode = hasMessage ? (
        <Text
            id={messageId}
            as='small'
            size='xs'
            tone={hasError ? undefined : 'muted'}
            className={cn('volt-form-field__message', hasError && 'volt-form-field__message--error')}
            role={hasError ? 'alert' : undefined}
        >
            {message}
        </Text>
    ) : null;

    if (layout === 'inline') {
        return (
            <div
                ref={ref}
                id={baseId}
                className={cn(
                    'volt-form-field volt-form-field--inline',
                    !hasLabel && 'volt-form-field--no-label',
                    className
                )}
                {...rest}
            >
                {labelNode}
                <div className='volt-form-field__body'>
                    <div className='volt-form-field__control'>{children}</div>
                    {messageNode}
                </div>
            </div>
        );
    }

    return (
        <Stack
            ref={ref}
            id={baseId}
            className={cn('volt-form-field', className)}
            {...rest}
        >
            {labelNode}
            <div className='volt-form-field__control'>{children}</div>
            {messageNode}
        </Stack>
    );
});

FormField.displayName = 'FormField';

export default FormField;
