import {
    Input,
    InputGroup,
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
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';

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

    const isInvalid = Boolean(error);
    const describedBy = fieldStatusAriaProps['aria-describedby'];
    const errorMessageId = fieldStatusAriaProps['aria-errormessage'];

    const renderField = () => {
        if (fieldType === 'select') {
            return (
                <Select
                    id={fieldId}
                    className='flex-1 min-w-0'
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
                                <OptionListBoxItem key={option.value} option={option} />
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
        <div className='form-field-container flex flex-col gap-2 w-full transition-opacity duration-150 ease-out'>
            {label && (
                <label
                    id={labelId}
                    htmlFor={labelTargetId}
                    className='text-xs font-medium text-muted'
                >
                    {label}
                </label>
            )}

            <div className='relative'>
                {renderField()}
            </div>

            {error && (
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className='form-field-error flex items-center gap-1 text-danger text-xs'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default DefaultFieldRenderer;
