import LiquidToggle from '@/shared/presentation/primitives/LiquidToggle';
import Select from '@/shared/presentation/primitives/Select';
import { matchReferenceWidth, useFloatingLayerRoot } from '@/shared/presentation/primitives/Select/floating-layer';
import { autoUpdate, flip, FloatingPortal, offset, shift, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { FieldRendererProps, FieldStatusAriaProps } from './FormFieldRHF.types';

const InlineCanvasFieldRenderer = ({
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
}: FieldRendererProps) => {
    const reactId = useId();
    const baseId = `${field.name || 'field'}-${reactId}`;
    const labelId = `${baseId}-label`;
    const errorId = `${baseId}-error`;
    const fieldId = inputProps?.id ?? `${baseId}-control`;
    const fieldName = inputProps?.name ?? field.name;
    const describedBy = [inputProps?.['aria-describedby'], error ? errorId : undefined]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ') || undefined;
    const ariaLabelledBy = label ? labelId : undefined;
    const fieldStatusAriaProps: FieldStatusAriaProps = {
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-errormessage': error ? errorId : undefined
    };
    const labelTargetId = fieldType === 'input' || fieldType === 'textarea' || fieldType === 'color'
        ? fieldId
        : undefined;

    const inputElementRef = useRef<HTMLInputElement | null>(null);
    const textareaElementRef = useRef<HTMLTextAreaElement | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const { floatingRoot, floatingOwnerIdsAttribute } = useFloatingLayerRoot();

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
            matchReferenceWidth()
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
    const datalistId = (suggestions?.length && !autocompleteEnabled) ? `${field.name}-suggestions` : undefined;

    const handleInlineFocus = (target: HTMLInputElement | HTMLTextAreaElement) => {
        onFetchSuggestions?.();
        if (autocompleteEnabled) {
            syncAutocompleteContext(target);
        }
    };

    const handleAutocompleteValueChange = (event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => {
        field.onChange(event.target.value);
        if (autocompleteEnabled) {
            syncAutocompleteContext(event.currentTarget);
        }
    };

    const handleInlineClick = (target: HTMLInputElement | HTMLTextAreaElement) => {
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
                    aria-labelledby={ariaLabelledBy}
                    {...fieldStatusAriaProps}
                />
            );
        }

        if (fieldType === 'checkbox') {
            return (
                <LiquidToggle
                    id={fieldId}
                    pressed={Boolean(effectiveValue)}
                    onChange={(next) => field.onChange(next)}
                    aria-labelledby={ariaLabelledBy}
                    {...fieldStatusAriaProps}
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
                    {...fieldStatusAriaProps}
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
                    onChange={handleAutocompleteValueChange}
                    onBlur={field.onBlur}
                    onFocus={(event) => handleInlineFocus(event.currentTarget)}
                    onClick={(event) => handleInlineClick(event.currentTarget)}
                    onKeyUp={handleAutocompleteKeyUp}
                    onKeyDown={handleAutocompleteKeyDown}
                    placeholder={placeholder}
                    rows={rows}
                    autoComplete={inputProps?.autoComplete}
                    inputMode={inputProps?.inputMode}
                    spellCheck={inputProps?.spellCheck}
                    disabled={disabled}
                    {...fieldStatusAriaProps}
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
                    onChange={handleAutocompleteValueChange}
                    onBlur={field.onBlur}
                    placeholder={placeholder}
                    autoComplete={inputProps?.autoComplete}
                    inputMode={inputProps?.inputMode}
                    spellCheck={inputProps?.spellCheck}
                    list={datalistId}
                    onFocus={(event) => handleInlineFocus(event.currentTarget)}
                    onClick={(event) => handleInlineClick(event.currentTarget)}
                    onKeyUp={handleAutocompleteKeyUp}
                    onKeyDown={handleAutocompleteKeyDown}
                    disabled={disabled}
                    {...fieldStatusAriaProps}
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
    } else if (label) {
        containerClass = containerBaseClass;
    } else {
        containerClass = `${containerBaseClass} form-field-inline-no-label`;
    }

    const labelClass = isCanvasVariant
        ? 'canvas-form-label'
        : 'form-field-inline-label font-size-2-5 font-weight-4 labeled-input-label';
    const loadingClass = isLoading ? 'is-loading form-field-loading' : '';

    return (
        <div className={`${containerClass} ${loadingClass}`}>
            {label && (
                <label id={labelId} htmlFor={labelTargetId} className={labelClass}>
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
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default InlineCanvasFieldRenderer;
