import {
    Description,
    Input,
    InputGroup,
    Label,
    ListBox,
    Select,
    Switch,
    TextArea,
    TextField,
    cn
} from '@heroui/react';
import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import type { FieldRendererProps } from '@/shared/contracts/form-field';
import { buildFieldAccessibilityState } from './field-accessibility';
import {
    FIELD_ERROR_CLASS,
    SELECT_ROOT_CLASS,
    STACKED_CONTAINER_CLASS,
    STACKED_LABEL_CLASS
} from './field-styles';

const DefaultFieldRenderer = ({
    field,
    error,
    label,
    fieldType,
    placeholder,
    icon,
    options,
    rows,
    className,
    disabled,
    type,
    autoFocus,
    inputProps
}: FieldRendererProps) => {
    const reactId = useId();
    const {
        labelId,
        errorId,
        fieldId,
        fieldName,
        ariaLabelledBy,
        fieldStatusAriaProps,
        labelTargetId
    } = buildFieldAccessibilityState({
        reactId,
        field,
        label,
        error,
        fieldType,
        inputProps
    });

    /*
     * `aria-invalid` is not part of any HeroUI/React-Aria field's prop surface —
     * react-aria's `filterDOMProps` drops unknown `aria-*` — so the boolean is
     * handed over as `isInvalid`, which is what puts `aria-invalid` on the real
     * control. `aria-describedby` and `aria-errormessage` are typed props and
     * pass straight through, so the wiring to the error node below is unchanged.
     */
    const isInvalid = Boolean(error);
    const describedBy = fieldStatusAriaProps['aria-describedby'];
    const errorMessageId = fieldStatusAriaProps['aria-errormessage'];

    const renderField = () => {
        if (fieldType === 'select') {
            return (
                <Select
                    id={fieldId}
                    className={SELECT_ROOT_CLASS}
                    selectedKey={String(field.value ?? '') || null}
                    onSelectionChange={(key) => field.onChange(key === null ? '' : String(key))}
                    placeholder={placeholder}
                    isDisabled={disabled}
                    isInvalid={isInvalid}
                    validationBehavior='aria'
                    fullWidth
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={describedBy}
                    aria-errormessage={errorMessageId}
                >
                    <Select.Trigger>
                        {/*
                          * bravais's trigger showed the selected option's `title`
                          * only; RAC's default children render the whole item, so
                          * a `description` would leak into the trigger.
                          */}
                        <Select.Value>
                            {({ isPlaceholder, selectedText, defaultChildren }) => (
                                isPlaceholder ? defaultChildren : selectedText
                            )}
                        </Select.Value>
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {options.map((option) => (
                                <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                    <ListBox.ItemIndicator />
                                    <Label>{option.title}</Label>
                                    {option.description && <Description>{option.description}</Description>}
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            );
        }

        if (fieldType === 'checkbox') {
            return (
                <Switch
                    id={fieldId}
                    isSelected={Boolean(field.value)}
                    onChange={(next) => field.onChange(next)}
                    isInvalid={isInvalid}
                    validationBehavior='aria'
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={describedBy}
                    aria-errormessage={errorMessageId}
                >
                    <Switch.Content>
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch.Content>
                </Switch>
            );
        }

        if (fieldType === 'color') {
            return (
                <input
                    id={fieldId}
                    type='color'
                    name={fieldName}
                    value={String(field.value ?? '#000000')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className='labeled-input-color'
                    disabled={disabled}
                    {...fieldStatusAriaProps}
                />
            );
        }

        if (fieldType === 'textarea') {
            return (
                <TextField
                    id={fieldId}
                    name={fieldName}
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    isDisabled={disabled}
                    isInvalid={isInvalid}
                    validationBehavior='aria'
                    fullWidth
                    aria-labelledby={ariaLabelledBy}
                    aria-describedby={describedBy}
                    aria-errormessage={errorMessageId}
                >
                    <TextArea
                        ref={field.ref}
                        rows={rows}
                        placeholder={placeholder}
                        autoComplete={inputProps?.autoComplete}
                        inputMode={inputProps?.inputMode}
                        spellCheck={inputProps?.spellCheck}
                        className={cn('resize-y', className)}
                    />
                </TextField>
            );
        }

        const { size: _size, ...restInputProps } = inputProps ?? {};
        /*
         * `type` stays on the control rather than on `TextField`, and after the
         * `inputProps` spread, to keep bravais's precedence: a call site passing
         * `inputProps={{ type: 'number' }}` to the stacked renderer was overridden
         * by the explicit `type` prop, and still is.
         *
         * `leftIcon` becomes an `InputGroup.Prefix`, which is HeroUI's affix slot;
         * the plain `Input` is kept for the iconless case so a field without an
         * adornment does not grow an extra wrapper element.
         */
        return (
            <TextField
                id={fieldId}
                name={fieldName}
                value={String(field.value ?? '')}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isDisabled={disabled}
                isInvalid={isInvalid}
                validationBehavior='aria'
                fullWidth
                aria-labelledby={ariaLabelledBy}
                aria-describedby={describedBy}
                aria-errormessage={errorMessageId}
            >
                {icon ? (
                    <InputGroup fullWidth>
                        {/* bravais rendered its adornments inside an aria-hidden span. */}
                        <InputGroup.Prefix aria-hidden='true'>{icon}</InputGroup.Prefix>
                        <InputGroup.Input
                            ref={field.ref}
                            {...restInputProps}
                            type={type ?? 'text'}
                            placeholder={placeholder}
                            autoFocus={autoFocus}
                            className={className}
                        />
                    </InputGroup>
                ) : (
                    <Input
                        ref={field.ref}
                        {...restInputProps}
                        type={type ?? 'text'}
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        className={className}
                    />
                )}
            </TextField>
        );
    };

    return (
        <div className={cn('form-field-container', STACKED_CONTAINER_CLASS)}>
            {label && (
                <label
                    id={labelId}
                    htmlFor={labelTargetId}
                    className={STACKED_LABEL_CLASS}
                >
                    {label}
                </label>
            )}

            <div className='relative'>
                {renderField()}
            </div>

            {error && (
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className={cn('form-field-error', FIELD_ERROR_CLASS)}>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default DefaultFieldRenderer;
