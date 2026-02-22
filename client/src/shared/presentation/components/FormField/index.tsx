import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, ChangeEvent, KeyboardEvent, MutableRefObject } from 'react';
import { AlertCircle } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import { cn } from '@/shared/utils';
import './FormField.css';

export type { SelectOption };

export interface FormFieldAutocompleteOption {
    value: string;
    label?: string;
}

export interface FormFieldAutocompleteConfig {
    trigger?: string;
    options: Array<string | number | FormFieldAutocompleteOption>;
    maxItems?: number;
}

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    label?: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    value?: string | number | boolean;
    error?: string;
    icon?: ReactNode;
    isLoading?: boolean;
    options?: SelectOption[];
    rows?: number;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    variant?: 'default' | 'inline' | 'canvas';
    // Canvas-style API (alternative)
    fieldKey?: string;
    fieldValue?: string | number | boolean;
    onFieldChange?: (key: string, value: string | number | boolean) => void;
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
    autocomplete?: FormFieldAutocompleteConfig;
};

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
    label,
    name,
    fieldType = 'input',
    value,
    onChange,
    error,
    icon,
    isLoading,
    options = [],
    placeholder,
    rows = 3,
    className = '',
    inputProps,
    variant = 'default',
    // Canvas-style API
    fieldKey,
    fieldValue,
    onFieldChange,
    suggestions,
    onFetchSuggestions,
    autocomplete,
    ...restProps
}, ref) => {
    // Determine which API is being used
    const isCanvasStyle = fieldKey !== undefined && onFieldChange !== undefined;
    const effectiveValue = isCanvasStyle ? fieldValue : value;
    const effectiveName = isCanvasStyle ? fieldKey : name;
    const inputElementRef = useRef<HTMLInputElement | null>(null);
    const textareaElementRef = useRef<HTMLTextAreaElement | null>(null);
    const renderInputContainerRef = useRef<HTMLDivElement | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const [autocompleteContext, setAutocompleteContext] = useState<{
        start: number;
        end: number;
        query: string;
    } | null>(null);
    const [activeAutocompleteIndex, setActiveAutocompleteIndex] = useState(0);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, e.target.value);
        } else {
            onChange?.(e as ChangeEvent<HTMLInputElement>);
        }
    };

    const handleSelectChange = (selectedValue: string) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, selectedValue);
        } else {
            const syntheticEvent = {
                target: { name: effectiveName, value: selectedValue }
            } as ChangeEvent<HTMLInputElement>;
            onChange?.(syntheticEvent);
        }
    };

    const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, e.target.value);
        } else {
            onChange?.(e);
        }
    };

    const assignInputRef = (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
            return;
        }
        if (ref) {
            (ref as MutableRefObject<HTMLInputElement | null>).current = node;
        }
    };

    const autocompleteOptions = useMemo(() => {
        if (!autocomplete?.options?.length) return [];
        return autocomplete.options
            .map((option) => {
                if (typeof option === 'string' || typeof option === 'number') {
                    const value = String(option);
                    return { value, label: value };
                }

                const value = String(option.value ?? '').trim();
                if (!value) return null;
                return {
                    value,
                    label: option.label?.trim() || value
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

    const emitValueChange = (nextValue: string) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, nextValue);
            return;
        }

        const syntheticEvent = {
            target: {
                name: effectiveName,
                value: nextValue
            }
        } as ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticEvent);
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

    const applyAutocompleteOption = (optionValue: string) => {
        if (!autocompleteContext) return;

        const activeElement = document.activeElement;
        const activeInput = activeElement === inputElementRef.current ? inputElementRef.current : null;
        const activeTextarea = activeElement === textareaElementRef.current ? textareaElementRef.current : null;
        const activeField = activeInput ?? activeTextarea ?? inputElementRef.current ?? textareaElementRef.current;
        const currentValue = activeField?.value ?? String(effectiveValue ?? '');

        const nextValue = `${currentValue.slice(0, autocompleteContext.start)}${optionValue}${currentValue.slice(autocompleteContext.end)}`;
        emitValueChange(nextValue);
        pendingCaretRef.current = autocompleteContext.start + optionValue.length;
        setAutocompleteContext(null);
        setActiveAutocompleteIndex(0);
    };

    useEffect(() => {
        if (!autocompleteOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (renderInputContainerRef.current?.contains(target)) return;
            setAutocompleteContext(null);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [autocompleteOpen]);

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

    // Inline/canvas variants (for workflow editors)
    if (variant === 'inline' || variant === 'canvas' || isCanvasStyle) {
        const datalistId = (suggestions?.length && !autocompleteEnabled) ? `${effectiveName}-suggestions` : undefined;
        const isCanvasVariant = variant === 'canvas' || isCanvasStyle;
        const fieldClass = isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input';
        const selectClass = isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select';
        const textareaClass = isCanvasVariant ? 'form-field-canvas-textarea' : 'form-field-inline-textarea';
        const containerBaseClass = isCanvasVariant ? 'form-field-canvas' : 'form-field-inline';

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
                setActiveAutocompleteIndex((prev) => (prev + 1) % filteredAutocompleteOptions.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveAutocompleteIndex((prev) => (prev - 1 + filteredAutocompleteOptions.length) % filteredAutocompleteOptions.length);
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
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
                return;
            }
            syncAutocompleteContext(event.currentTarget);
        };

        const renderInlineField = () => {
            switch (fieldType) {
                case 'select':
                    return (
                        <Select
                            options={options}
                            value={String(effectiveValue ?? '')}
                            onChange={handleSelectChange}
                            placeholder={placeholder}
                            className={`${selectClass} labeled-input`}
                        />
                    );

                case 'checkbox':
                    return (
                        <LiquidToggle
                            pressed={Boolean(effectiveValue)}
                            onChange={(next) => {
                                if (isCanvasStyle && fieldKey) {
                                    onFieldChange!(fieldKey, next);
                                } else {
                                    const syntheticEvent = {
                                        target: { name: effectiveName, checked: next }
                                    } as ChangeEvent<HTMLInputElement>;
                                    onChange?.(syntheticEvent);
                                }
                            }}
                        />
                    );

                case 'color':
                    return (
                        <input
                            type='color'
                            value={typeof effectiveValue === 'string' ? effectiveValue : String(effectiveValue)}
                            onChange={handleColorChange}
                            className='labeled-input-color'
                            {...inputProps}
                        />
                    );

                case 'textarea':
                    return (
                        <textarea
                            ref={textareaElementRef}
                            name={effectiveName as string}
                            className={`${fieldClass} ${textareaClass}`}
                            value={String(effectiveValue ?? '')}
                            onChange={(e) => {
                                handleInputChange(e);
                                if (autocompleteEnabled) {
                                    syncAutocompleteContext(e.currentTarget);
                                }
                            }}
                            onFocus={(e) => handleInlineFocus(e.currentTarget)}
                            onClick={(e) => autocompleteEnabled && syncAutocompleteContext(e.currentTarget)}
                            onKeyUp={handleAutocompleteKeyUp}
                            onKeyDown={handleAutocompleteKeyDown}
                            placeholder={placeholder}
                            rows={rows}
                        />
                    );

                case 'input':
                default:
                    return (
                        <>
                            <input
                                ref={assignInputRef}
                                name={effectiveName as string}
                                {...inputProps}
                                className={`${fieldClass} labeled-input`}
                                value={String(effectiveValue ?? '')}
                                onChange={(e) => {
                                    handleInputChange(e);
                                    if (autocompleteEnabled) {
                                        syncAutocompleteContext(e.currentTarget);
                                    }
                                }}
                                placeholder={placeholder}
                                list={datalistId}
                                onFocus={(e) => handleInlineFocus(e.currentTarget)}
                                onClick={(e) => autocompleteEnabled && syncAutocompleteContext(e.currentTarget)}
                                onKeyUp={handleAutocompleteKeyUp}
                                onKeyDown={handleAutocompleteKeyDown}
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
            }
        };

        const isCheckbox = fieldType === 'checkbox';
        const hasLabel = Boolean(label);
        const containerClass = isCheckbox
            ? `${containerBaseClass} form-field-inline-checkbox-container d-flex content-between items-center checkbox-container`
            : isCanvasVariant
                ? `${containerBaseClass} d-flex content-between items-center gap-1`
                : `${containerBaseClass}${hasLabel ? '' : ' form-field-inline-no-label'}`;

        const labelClass = isCanvasVariant
            ? 'canvas-form-label'
            : 'form-field-inline-label font-size-2-5 font-weight-4 labeled-input-label';

        return (
            <Container className={`${containerClass} ${isLoading ? 'is-loading form-field-loading' : ''}`}>
                {hasLabel && <span className={labelClass}>{label}</span>}
                <Container ref={renderInputContainerRef} className='d-flex items-center render-input-container p-relative'>
                    {renderInlineField()}
                    {autocompleteOpen && (
                        <Container className='form-field-autocomplete-menu d-flex column'>
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
                        </Container>
                    )}
                </Container>
            </Container>
        );
    }

    // Default variant (vertical layout with spread props)
    const containerClass = isLoading ? 'is-loading' : '';
    const inputClass = cn(
        'form-field-input radius-sm w-max',
        error && 'has-error',
        !!icon && 'has-icon',
        className
    );

    return (
        <Container className={`form-field-container d-flex column gap-05 w-max ${containerClass}`}>
            {label && (
                <label className='font-size-2 font-weight-5 color-secondary'>
                    {label}
                </label>
            )}

            <Container className='p-relative'>
                <input
                    ref={assignInputRef}
                    name={effectiveName as string}
                    className={inputClass}
                    placeholder={placeholder}
                    value={String(effectiveValue ?? '')}
                    onChange={handleInputChange}
                    {...restProps}
                />
                {icon && (
                    <Container className='form-field-icon p-absolute d-flex flex-center'>
                        {icon}
                    </Container>
                )}
            </Container>

            {error && (
                <Container className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </Container>
            )}
        </Container>
    );
});

FormField.displayName = 'FormField';

export default FormField;
