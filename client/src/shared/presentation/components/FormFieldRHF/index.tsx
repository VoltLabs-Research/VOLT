import {
    getFloatingOwnerIdsAttribute,
    useFloatingOwnerIds,
    useTopLayerRoot
} from '@/shared/presentation/contexts/FloatingRootContext';
import { cn } from '@/shared/utils';
import { LiquidToggle } from '@/shared/presentation/primitives';
import { Select } from '@/shared/presentation/primitives';
import './FormField.css';
import { useFloating, useDismiss, useInteractions, FloatingPortal, offset, flip, shift, size, autoUpdate } from '@floating-ui/react';
import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react';
import { Controller } from 'react-hook-form';
import type { SelectOption } from '@/shared/presentation/primitives';
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode, RefCallback } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';

type NativeInputProps = InputHTMLAttributes<HTMLInputElement>;
type BooleanInputProp = boolean | 'true' | 'false';

interface SyntheticInputTarget {
    name: string;
    value: string;
};

interface SyntheticChangeEvent {
    target: SyntheticInputTarget;
    currentTarget: SyntheticInputTarget;
};

type FormFieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | SyntheticChangeEvent;
type FormFieldChangeHandler = {
    bivarianceHack(event: FormFieldChangeEvent): void;
}['bivarianceHack'];

export type { SelectOption };

export interface FormFieldAutocompleteOption {
    value: string;
    label?: string;
};

export interface FormFieldAutocompleteConfig {
    trigger?: string;
    options: Array<string | number | FormFieldAutocompleteOption>;
    maxItems?: number;
};

interface FieldAccessibilityIds {
    fieldId: string;
    labelId: string;
    errorId: string;
};

interface SharedFieldProps {
    label?: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    placeholder?: string;
    icon?: ReactNode;
    options?: SelectOption[];
    rows?: number;
    className?: string;
    disabled?: boolean;
    type?: string;
    autoFocus?: boolean;
    variant?: 'default' | 'inline' | 'canvas';
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
    autocomplete?: FormFieldAutocompleteConfig;
    inputProps?: NativeInputProps;
    isLoading?: boolean;
    error?: string;
};

interface ControlledProps<TForm extends FieldValues> extends SharedFieldProps {
    name: Path<TForm>;
    control: Control<TForm>;
    value?: never;
    onChange?: never;
    onBlur?: never;
    fieldKey?: never;
    fieldValue?: never;
    onFieldChange?: never;
};

interface UncontrolledProps extends SharedFieldProps {
    name?: string;
    control?: never;
    value?: string | number | boolean;
    onChange?: FormFieldChangeHandler;
    onBlur?: () => void;
    fieldKey?: never;
    fieldValue?: never;
    onFieldChange?: never;
};

interface CanvasStyleProps extends SharedFieldProps {
    name?: never;
    control?: never;
    value?: never;
    onChange?: never;
    onBlur?: never;
    fieldKey: string;
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: string | number | boolean) => void;
};

type FormFieldRHFProps<TForm extends FieldValues = FieldValues> =
    | ControlledProps<TForm>
    | UncontrolledProps
    | CanvasStyleProps;

const isControlled = <TForm extends FieldValues>(
    props: FormFieldRHFProps<TForm>
): props is ControlledProps<TForm> => {
    return props.control !== undefined && props.control !== null;
};

const isCanvasStyle = <TForm extends FieldValues>(
    props: FormFieldRHFProps<TForm>
): props is CanvasStyleProps => {
    return 'fieldKey' in props
        && 'onFieldChange' in props
        && props.fieldKey !== undefined
        && props.onFieldChange !== undefined;
};

const sanitizeFieldIdFragment = (value: string) => {
    return value.replace(/[^a-zA-Z0-9-_:.]/g, '-');
};

const buildFieldAccessibilityIds = (name: string, reactId: string): FieldAccessibilityIds => {
    const safeName = name ? sanitizeFieldIdFragment(name) : 'field';
    const safeReactId = sanitizeFieldIdFragment(reactId);
    const baseId = `${safeName}-${safeReactId}`;

    return {
        fieldId: `${baseId}-control`,
        labelId: `${baseId}-label`,
        errorId: `${baseId}-error`
    };
};

const mergeDescribedBy = (...values: Array<string | undefined>) => {
    const mergedValues = values.filter((value): value is string => Boolean(value?.trim()));

    if (mergedValues.length === 0) {
        return undefined;
    }

    return mergedValues.join(' ');
};

const resolveBooleanInputProp = (value?: BooleanInputProp) => {
    return value;
};

const resolveAutocomplete = (inputProps?: NativeInputProps) => {
    return inputProps?.autoComplete;
};

const resolveInputMode = (inputProps?: NativeInputProps) => {
    return inputProps?.inputMode;
};

const resolveSpellCheck = (inputProps?: NativeInputProps) => {
    return resolveBooleanInputProp(inputProps?.spellCheck);
};

const isSyntheticFieldChangeEvent = (value: unknown): value is ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> => {
    if (!value || typeof value !== 'object' || !('target' in value)) {
        return false;
    }

    const target = value.target;
    if (!target || typeof target !== 'object') {
        return false;
    }

    return 'value' in target;
};

const FormFieldRHF = <TForm extends FieldValues = FieldValues>(props: FormFieldRHFProps<TForm>) => {
    const {
        label,
        fieldType = 'input',
        placeholder,
        icon,
        options = [],
        rows = 3,
        className = '',
        disabled = false,
        type,
        autoFocus = false,
        variant = 'default',
        suggestions,
        onFetchSuggestions,
        autocomplete,
        inputProps,
        isLoading = false
    } = props;

    if (isControlled(props)) {
        return (
            <Controller
                name={props.name}
                control={props.control}
                render={({ field, fieldState }) => {
                    const fieldError = fieldState.error?.message;
                    return (
                        <FieldRenderer
                            field={field}
                            error={fieldError}
                            label={label}
                            fieldType={fieldType}
                            placeholder={placeholder}
                            icon={icon}
                            options={options}
                            rows={rows}
                            className={className}
                            disabled={disabled}
                            type={type}
                            autoFocus={autoFocus}
                            variant={variant}
                            suggestions={suggestions}
                            onFetchSuggestions={onFetchSuggestions}
                            autocomplete={autocomplete}
                            inputProps={inputProps}
                            isLoading={isLoading}
                        />
                    );
                }}
            />
        );
    }

    if (isCanvasStyle(props)) {
        const syntheticField: ControllerField = {
            value: props.fieldValue,
            onChange: (nextValue: unknown) => {
                if (typeof nextValue !== 'string' && typeof nextValue !== 'number' && typeof nextValue !== 'boolean') {
                    return;
                }

                props.onFieldChange(props.fieldKey, nextValue);
            },
            onBlur: () => {},
            name: props.fieldKey,
            ref: () => {}
        };

        return (
            <FieldRenderer
                field={syntheticField}
                error={props.error}
                label={label}
                fieldType={fieldType}
                placeholder={placeholder}
                icon={icon}
                options={options}
                rows={rows}
                className={className}
                disabled={disabled}
                type={type}
                autoFocus={autoFocus}
                variant={variant}
                suggestions={suggestions}
                onFetchSuggestions={onFetchSuggestions}
                autocomplete={autocomplete}
                inputProps={inputProps}
                isLoading={isLoading}
            />
        );
    }

    const uncontrolledProps = props;
    const syntheticField: ControllerField = {
        value: uncontrolledProps.value ?? '',
        onChange: (eventOrValue: unknown) => {
            if (!uncontrolledProps.onChange) return;
            if (isSyntheticFieldChangeEvent(eventOrValue)) {
                uncontrolledProps.onChange(eventOrValue);
                return;
            }

            const syntheticEvent = {
                target: {
                    name: uncontrolledProps.name ?? '',
                    value: String(eventOrValue ?? '')
                },
                currentTarget: {
                    name: uncontrolledProps.name ?? '',
                    value: String(eventOrValue ?? '')
                }
            };

            uncontrolledProps.onChange(syntheticEvent);
        },
        onBlur: uncontrolledProps.onBlur ?? (() => {}),
        name: uncontrolledProps.name ?? '',
        ref: () => {}
    };

    return (
        <FieldRenderer
            field={syntheticField}
            error={uncontrolledProps.error}
            label={label}
            fieldType={fieldType}
            placeholder={placeholder}
            icon={icon}
            options={options}
            rows={rows}
            className={className}
            disabled={disabled}
            type={type}
            autoFocus={autoFocus}
            variant={variant}
            suggestions={suggestions}
            onFetchSuggestions={onFetchSuggestions}
            autocomplete={autocomplete}
            inputProps={inputProps}
            isLoading={isLoading}
        />
    );
};

interface ControllerField {
    value: unknown;
    onChange: (...args: unknown[]) => void;
    onBlur: () => void;
    name: string;
    ref: RefCallback<HTMLInputElement | HTMLTextAreaElement>;
};

interface FieldRendererProps {
    field: ControllerField;
    error?: string;
    label?: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    placeholder?: string;
    icon?: ReactNode;
    options: SelectOption[];
    rows: number;
    className: string;
    disabled: boolean;
    type?: string;
    autoFocus: boolean;
    variant: 'default' | 'inline' | 'canvas';
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
    autocomplete?: FormFieldAutocompleteConfig;
    inputProps?: NativeInputProps;
    isLoading: boolean;
};

const FieldRenderer = (props: FieldRendererProps) => {
    const { variant } = props;

    if (variant === 'inline' || variant === 'canvas') {
        return <InlineCanvasRenderer {...props} variant={variant} />;
    }

    return <DefaultRenderer {...props} />;
};

const DefaultRenderer = ({
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
    const ids = buildFieldAccessibilityIds(field.name, reactId);
    const fieldId = inputProps?.id ?? ids.fieldId;
    const describedBy = mergeDescribedBy(inputProps?.['aria-describedby'], error ? ids.errorId : undefined);
    const ariaInvalid = error ? true : undefined;
    const errorMessageId = error ? ids.errorId : undefined;
    const fieldName = inputProps?.name ?? field.name;
    const autoComplete = resolveAutocomplete(inputProps);
    const inputMode = resolveInputMode(inputProps);
    const spellCheck = resolveSpellCheck(inputProps);

    const renderField = () => {
        if (fieldType === 'select') {
            return (
                <Select
                    id={fieldId}
                    options={options}
                    value={String(field.value ?? '')}
                    onChange={(value) => field.onChange(value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-labelledby={label ? ids.labelId : undefined}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        if (fieldType === 'checkbox') {
            return (
                <LiquidToggle
                    id={fieldId}
                    pressed={Boolean(field.value)}
                    onChange={(next) => field.onChange(next)}
                    aria-labelledby={label ? ids.labelId : undefined}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
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
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        if (fieldType === 'textarea') {
            return (
                <textarea
                    ref={field.ref}
                    id={fieldId}
                    name={fieldName}
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={placeholder}
                    rows={rows}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    spellCheck={spellCheck}
                    disabled={disabled}
                    className={cn(
                        'form-field-input radius-sm w-max',
                        error && 'has-error',
                        className
                    )}
                    style={{
                        resize: 'vertical',
                        minHeight: 80
                    }}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        return (
            <input
                ref={field.ref}
                id={fieldId}
                name={fieldName}
                {...inputProps}
                type={type ?? 'text'}
                value={String(field.value ?? '')}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={placeholder}
                autoComplete={autoComplete}
                inputMode={inputMode}
                spellCheck={spellCheck}
                disabled={disabled}
                autoFocus={autoFocus}
                className={cn(
                    'form-field-input radius-sm w-max',
                    error && 'has-error',
                    !!icon && 'has-icon',
                    className
                )}
                aria-describedby={describedBy}
                aria-invalid={ariaInvalid}
                aria-errormessage={errorMessageId}
            />
        );
    };

    return (
        <div className='form-field-container d-flex column gap-05 w-max'>
            {label && (
                <label
                    id={ids.labelId}
                    htmlFor={fieldType === 'input' || fieldType === 'textarea' || fieldType === 'color' ? fieldId : undefined}
                    className='font-size-2 font-weight-5 color-secondary'
                >
                    {label}
                </label>
            )}

            <div className='p-relative'>
                {renderField()}
                {icon && (
                    <div className='form-field-icon p-absolute d-flex flex-center'>
                        {icon}
                    </div>
                )}
            </div>

            {error && (
                <div id={ids.errorId} role='status' aria-live='polite' aria-atomic='true' className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

interface InlineCanvasRendererExplicitProps extends FieldRendererProps {
    variant: 'inline' | 'canvas';
};

const InlineCanvasRenderer = ({
    field,
    error,
    label,
    fieldType,
    placeholder,
    options,
    rows,
    disabled,
    variant,
    suggestions,
    onFetchSuggestions,
    autocomplete,
    inputProps,
    isLoading
}: InlineCanvasRendererExplicitProps) => {
    const inputElementRef = useRef<HTMLInputElement | null>(null);
    const textareaElementRef = useRef<HTMLTextAreaElement | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const floatingRoot = useTopLayerRoot();
    const floatingOwnerIds = useFloatingOwnerIds();
    const floatingOwnerIdsAttribute = getFloatingOwnerIdsAttribute(floatingOwnerIds);
    const reactId = useId();
    const ids = buildFieldAccessibilityIds(field.name, reactId);

    const [autocompleteContext, setAutocompleteContext] = useState<{
        start: number;
        end: number;
        query: string;
    } | null>(null);
    const [activeAutocompleteIndex, setActiveAutocompleteIndex] = useState(0);

    const effectiveValue = field.value;
    const isCanvasVariant = variant === 'canvas';

    const autocompleteOptions = useMemo(() => {
        if (!autocomplete?.options?.length) return [];
        return autocomplete.options
            .map((option) => {
                if (typeof option === 'string' || typeof option === 'number') {
                    const stringValue = String(option);
                    return {
                        value: stringValue,
                        label: stringValue
                    };
                }
                const stringValue = String(option.value ?? '').trim();
                if (!stringValue) return null;
                return {
                    value: stringValue,
                    label: option.label?.trim() || stringValue
                };
            })
            .filter((option): option is { value: string; label: string } => option !== null);
    }, [autocomplete?.options]);

    const autocompleteTrigger = autocomplete?.trigger ?? '{{';
    const autocompleteEnabled = (fieldType === 'input' || fieldType === 'textarea') && autocompleteOptions.length > 0;
    const autocompleteMaxItems = autocomplete?.maxItems ?? 8;

    const resolveAutocompleteContext = (rawValue: string, caretPosition: number) => {
        if (!autocompleteEnabled) return null;
        const prefix = rawValue.slice(0, caretPosition);
        const triggerIndex = prefix.lastIndexOf(autocompleteTrigger);
        if (triggerIndex === -1) return null;

        const token = prefix.slice(triggerIndex + autocompleteTrigger.length);
        if (token.includes('}}') || token.includes('\n')) return null;

        return {
            start: triggerIndex,
            end: caretPosition,
            query: token.trim()
        };
    };

    const syncAutocompleteContext = (target: HTMLInputElement | HTMLTextAreaElement) => {
        const caretPosition = target.selectionStart ?? target.value.length;
        const context = resolveAutocompleteContext(target.value, caretPosition);
        setAutocompleteContext(context);
        setActiveAutocompleteIndex(0);
    };

    const filteredAutocompleteOptions = useMemo(() => {
        if (!autocompleteContext) return [];
        const query = autocompleteContext.query.toLowerCase();
        const items = autocompleteOptions.filter((option) => {
            if (!query) return true;
            return option.value.toLowerCase().includes(query) || option.label.toLowerCase().includes(query);
        });
        return items.slice(0, autocompleteMaxItems);
    }, [autocompleteContext, autocompleteOptions, autocompleteMaxItems]);

    const autocompleteOpen = Boolean(autocompleteContext) && filteredAutocompleteOptions.length > 0;

    const handleAutocompleteOpenChange = useCallback((open: boolean) => {
        if (!open) {
            setAutocompleteContext(null);
        }
    }, []);

    const { refs: autocompleteRefs, floatingStyles: autocompleteFloatingStyles, context: autocompleteFloatingContext } = useFloating({
        open: autocompleteOpen,
        onOpenChange: handleAutocompleteOpenChange,
        placement: 'bottom-start',
        middleware: [
            offset(4),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
                apply({ rects, elements }) {
                    Object.assign(elements.floating.style, {
                        minWidth: `${rects.reference.width}px`
                    });
                },
                padding: 8
            })
        ],
        whileElementsMounted: autoUpdate
    });

    const autocompleteDismiss = useDismiss(autocompleteFloatingContext);
    const { getFloatingProps: getAutocompleteFloatingProps } = useInteractions([autocompleteDismiss]);

    const applyAutocompleteOption = (optionValue: string) => {
        if (!autocompleteContext) return;

        const activeElement = document.activeElement;
        const activeInput = activeElement === inputElementRef.current ? inputElementRef.current : null;
        const activeTextarea = activeElement === textareaElementRef.current ? textareaElementRef.current : null;
        const activeField = activeInput ?? activeTextarea ?? inputElementRef.current ?? textareaElementRef.current;
        const currentValue = activeField?.value ?? String(effectiveValue ?? '');

        const nextValue = `${currentValue.slice(0, autocompleteContext.start)}${optionValue}${currentValue.slice(autocompleteContext.end)}`;
        field.onChange(nextValue);
        pendingCaretRef.current = autocompleteContext.start + optionValue.length;
        setAutocompleteContext(null);
        setActiveAutocompleteIndex(0);
    };

    useEffect(() => {
        if (pendingCaretRef.current === null) return;
        const nextCaret = pendingCaretRef.current;
        const target = fieldType === 'textarea' ? textareaElementRef.current : inputElementRef.current;
        if (!target) {
            pendingCaretRef.current = null;
            return;
        }

        requestAnimationFrame(() => {
            target.focus();
            target.setSelectionRange(nextCaret, nextCaret);
            pendingCaretRef.current = null;
        });
    }, [effectiveValue, fieldType]);

    const fieldClass = isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input';
    const selectClass = isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select';
    const textareaClass = isCanvasVariant ? 'form-field-canvas-textarea' : 'form-field-inline-textarea';
    const containerBaseClass = isCanvasVariant ? 'form-field-canvas' : 'form-field-inline';

    const hasLabel = Boolean(label);
    const datalistId = (suggestions?.length && !autocompleteEnabled) ? `${field.name}-suggestions` : undefined;
    const fieldId = inputProps?.id ?? ids.fieldId;
    const describedBy = mergeDescribedBy(inputProps?.['aria-describedby'], error ? ids.errorId : undefined);
    const ariaInvalid = error ? true : undefined;
    const errorMessageId = error ? ids.errorId : undefined;
    const fieldName = inputProps?.name ?? field.name;
    const autoComplete = resolveAutocomplete(inputProps);
    const inputMode = resolveInputMode(inputProps);
    const spellCheck = resolveSpellCheck(inputProps);

    const handleInlineFocus = (target: HTMLInputElement | HTMLTextAreaElement) => {
        onFetchSuggestions?.();
        if (autocompleteEnabled) {
            syncAutocompleteContext(target);
        }
    };

    const handleAutocompleteKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!autocompleteOpen) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveAutocompleteIndex((previous) => (previous + 1) % filteredAutocompleteOptions.length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveAutocompleteIndex((previous) => (previous - 1 + filteredAutocompleteOptions.length) % filteredAutocompleteOptions.length);
            return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            const option = filteredAutocompleteOptions[activeAutocompleteIndex];
            if (option) {
                applyAutocompleteOption(option.value);
            }
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            setAutocompleteContext(null);
        }
    };

    const handleAutocompleteKeyUp = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!autocompleteEnabled) return;
        const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'];
        if (navigationKeys.includes(event.key)) return;
        syncAutocompleteContext(event.currentTarget);
    };

    const assignInputRef = (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        if (typeof field.ref === 'function') {
            field.ref(node);
        }
    };

    const renderInlineField = () => {
        if (fieldType === 'select') {
            return (
                <Select
                    id={fieldId}
                    options={options}
                    value={String(effectiveValue ?? '')}
                    onChange={(selectedValue) => field.onChange(selectedValue)}
                    placeholder={placeholder}
                    className={`${selectClass} labeled-input`}
                    disabled={disabled}
                    aria-labelledby={hasLabel ? ids.labelId : undefined}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        if (fieldType === 'checkbox') {
            return (
                <LiquidToggle
                    id={fieldId}
                    pressed={Boolean(effectiveValue)}
                    onChange={(next) => field.onChange(next)}
                    aria-labelledby={hasLabel ? ids.labelId : undefined}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        if (fieldType === 'color') {
            return (
                <input
                    id={fieldId}
                    type='color'
                    name={fieldName}
                    value={typeof effectiveValue === 'string' ? effectiveValue : String(effectiveValue)}
                    onChange={(event) => field.onChange(event.target.value)}
                    className='labeled-input-color'
                    disabled={disabled}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                    {...inputProps}
                />
            );
        }

        if (fieldType === 'textarea') {
            return (
                <textarea
                    ref={textareaElementRef}
                    id={fieldId}
                    name={fieldName}
                    className={`${fieldClass} ${textareaClass}`}
                    value={String(effectiveValue ?? '')}
                    onChange={(event) => {
                        field.onChange(event.target.value);
                        if (autocompleteEnabled) {
                            syncAutocompleteContext(event.currentTarget);
                        }
                    }}
                    onBlur={field.onBlur}
                    onFocus={(event) => handleInlineFocus(event.currentTarget)}
                    onClick={(event) => autocompleteEnabled && syncAutocompleteContext(event.currentTarget)}
                    onKeyUp={handleAutocompleteKeyUp}
                    onKeyDown={handleAutocompleteKeyDown}
                    placeholder={placeholder}
                    rows={rows}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    spellCheck={spellCheck}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
            );
        }

        return (
            <>
                <input
                    ref={assignInputRef}
                    id={fieldId}
                    name={fieldName}
                    {...inputProps}
                    className={`${fieldClass} labeled-input`}
                    value={String(effectiveValue ?? '')}
                    onChange={(event) => {
                        field.onChange(event.target.value);
                        if (autocompleteEnabled) {
                            syncAutocompleteContext(event.currentTarget);
                        }
                    }}
                    onBlur={field.onBlur}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    spellCheck={spellCheck}
                    list={datalistId}
                    onFocus={(event) => handleInlineFocus(event.currentTarget)}
                    onClick={(event) => autocompleteEnabled && syncAutocompleteContext(event.currentTarget)}
                    onKeyUp={handleAutocompleteKeyUp}
                    onKeyDown={handleAutocompleteKeyDown}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    aria-invalid={ariaInvalid}
                    aria-errormessage={errorMessageId}
                />
                {datalistId && suggestions && (
                    <datalist id={datalistId}>
                        {suggestions.map((option) => (
                            <option key={String(option)} value={String(option)} />
                        ))}
                    </datalist>
                )}
            </>
        );
    };

    let containerClass: string;
    if (fieldType === 'checkbox') {
        containerClass = `${containerBaseClass} form-field-inline-checkbox-container d-flex content-between items-center checkbox-container`;
    } else if (isCanvasVariant) {
        containerClass = `${containerBaseClass} d-flex content-between items-center gap-1`;
    } else if (hasLabel) {
        containerClass = containerBaseClass;
    } else {
        containerClass = `${containerBaseClass} form-field-inline-no-label`;
    }

    let labelClass = 'form-field-inline-label font-size-2-5 font-weight-4 labeled-input-label';
    if (isCanvasVariant) {
        labelClass = 'canvas-form-label';
    }

    let loadingClass = '';
    if (isLoading) {
        loadingClass = 'is-loading form-field-loading';
    }

    return (
        <div className={`${containerClass} ${loadingClass}`}>
            {hasLabel && (
                <label
                    id={ids.labelId}
                    htmlFor={fieldType === 'input' || fieldType === 'textarea' || fieldType === 'color' ? fieldId : undefined}
                    className={labelClass}
                >
                    {label}
                </label>
            )}
            <div ref={autocompleteRefs.setReference} className='d-flex items-center render-input-container w-max content-end p-relative'>
                {renderInlineField()}
            </div>

            {autocompleteOpen && (
                <FloatingPortal root={floatingRoot}>
                    <div ref={autocompleteRefs.setFloating} className='form-field-autocomplete-menu d-flex column' data-floating-owner-ids={floatingOwnerIdsAttribute} style={autocompleteFloatingStyles} {...getAutocompleteFloatingProps()}>
                        {filteredAutocompleteOptions.map((option, index) => (
                            <button
                                type='button'
                                key={`${option.value}-${index}`}
                                className={`form-field-autocomplete-option ${index === activeAutocompleteIndex ? 'is-active' : ''}`}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    applyAutocompleteOption(option.value);
                                }}
                            >
                                <span className='form-field-autocomplete-option-label'>{option.label}</span>
                                {option.label !== option.value && (
                                    <span className='form-field-autocomplete-option-value'>{option.value}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </FloatingPortal>
            )}

            {error && (
                <div id={ids.errorId} role='status' aria-live='polite' aria-atomic='true' className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default FormFieldRHF;
