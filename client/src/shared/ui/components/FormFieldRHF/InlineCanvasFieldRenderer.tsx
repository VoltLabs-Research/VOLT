import useFieldAutocomplete from './use-field-autocomplete';
import { buildFieldAccessibilityState } from './field-accessibility';
import { LiquidToggle, Select } from '@voltstack/bravais';
import { useFloatingLayerRoot } from '@/shared/ui/utils/floating-layer';
import { FloatingPortal } from '@floating-ui/react';
import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import type { FieldRendererProps } from '@/shared/contracts/form-field';
import type { FieldTextElement } from './use-field-autocomplete';

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

    const { floatingRoot, floatingOwnerIdsAttribute } = useFloatingLayerRoot();
    const tokenAutocomplete = useFieldAutocomplete({
        field,
        fieldType,
        autocomplete
    });

    const effectiveValue = field.value;
    const isCanvasVariant = variant === 'canvas';
    const fieldClass = isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input';
    const selectClass = isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select';
    const textareaClass = isCanvasVariant ? 'form-field-canvas-textarea' : 'form-field-inline-textarea';
    const containerBaseClass = isCanvasVariant ? 'form-field-canvas' : 'form-field-inline';
    const datalistId = (suggestions?.length && !tokenAutocomplete.isEnabled) ? `${field.name}-suggestions` : undefined;

    const handleValueChange = (event: ChangeEvent<FieldTextElement>) => {
        field.onChange(event.target.value);
        tokenAutocomplete.syncToken(event.currentTarget);
    };

    const handleFocus = (event: FocusEvent<FieldTextElement>) => {
        onFetchSuggestions?.();
        tokenAutocomplete.syncToken(event.currentTarget);
    };

    const renderInlineField = () => {
        if(fieldType === 'select'){
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

        if(fieldType === 'checkbox'){
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

        if(fieldType === 'color'){
            return (
                <input
                    id={fieldId}
                    type='color'
                    name={fieldName}
                    value={String(effectiveValue)}
                    onChange={(event) => field.onChange(event.target.value)}
                    className='labeled-input-color'
                    disabled={disabled}
                    {...fieldStatusAriaProps}
                    {...inputProps}
                />
            );
        }

        if(fieldType === 'textarea'){
            return (
                <textarea
                    ref={tokenAutocomplete.textareaRef}
                    id={fieldId}
                    name={fieldName}
                    className={`${fieldClass} ${textareaClass}`}
                    value={String(effectiveValue ?? '')}
                    onChange={handleValueChange}
                    onBlur={field.onBlur}
                    onFocus={handleFocus}
                    onClick={(event) => tokenAutocomplete.syncToken(event.currentTarget)}
                    onKeyUp={tokenAutocomplete.handleKeyUp}
                    onKeyDown={tokenAutocomplete.handleKeyDown}
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
                    ref={(node) => {
                        tokenAutocomplete.inputRef.current = node;
                        field.ref(node);
                    }}
                    id={fieldId}
                    name={fieldName}
                    {...inputProps}
                    className={`${fieldClass} labeled-input`}
                    value={String(effectiveValue ?? '')}
                    onChange={handleValueChange}
                    onBlur={field.onBlur}
                    placeholder={placeholder}
                    autoComplete={inputProps?.autoComplete}
                    inputMode={inputProps?.inputMode}
                    spellCheck={inputProps?.spellCheck}
                    list={datalistId}
                    onFocus={handleFocus}
                    onClick={(event) => tokenAutocomplete.syncToken(event.currentTarget)}
                    onKeyUp={tokenAutocomplete.handleKeyUp}
                    onKeyDown={tokenAutocomplete.handleKeyDown}
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
    if(fieldType === 'checkbox'){
        containerClass = `${containerBaseClass} form-field-inline-checkbox-container flex justify-between items-center checkbox-container`;
    }else if(isCanvasVariant){
        containerClass = `${containerBaseClass} flex justify-between items-center gap-4`;
    }else if(label){
        containerClass = containerBaseClass;
    }else{
        containerClass = `${containerBaseClass} form-field-inline-no-label`;
    }

    const labelClass = isCanvasVariant
        ? 'canvas-form-label'
        : 'form-field-inline-label text-[0.95rem] font-normal labeled-input-label';
    const loadingClass = isLoading ? 'is-loading form-field-loading' : '';

    return (
        <div className={`${containerClass} ${loadingClass}`}>
            {label && (
                <label id={labelId} htmlFor={labelTargetId} className={labelClass}>
                    {label}
                </label>
            )}
            <div ref={tokenAutocomplete.refs.setReference} className='flex items-center render-input-container w-full justify-end relative'>
                {renderInlineField()}
            </div>

            {tokenAutocomplete.isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <div ref={tokenAutocomplete.refs.setFloating} className='form-field-autocomplete-menu flex flex-col' data-floating-owner-ids={floatingOwnerIdsAttribute} style={tokenAutocomplete.floatingStyles} {...tokenAutocomplete.getFloatingProps()}>
                        {tokenAutocomplete.options.map((option, index) => (
                            <button
                                type='button'
                                key={`${option.value}-${index}`}
                                className={`form-field-autocomplete-option ${index === tokenAutocomplete.activeIndex ? 'is-active' : ''}`}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    tokenAutocomplete.applyOption(option.value);
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
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className='flex items-center gap-1 form-field-error text-sm'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default InlineCanvasFieldRenderer;
