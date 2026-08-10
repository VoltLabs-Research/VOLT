import useFieldAutocomplete from './use-field-autocomplete';
import { buildFieldAccessibilityState } from './field-accessibility';
import {
    AUTOCOMPLETE_MENU_CLASS,
    AUTOCOMPLETE_OPTION_ACTIVE_CLASS,
    AUTOCOMPLETE_OPTION_CLASS,
    AUTOCOMPLETE_OPTION_LABEL_CLASS,
    AUTOCOMPLETE_OPTION_VALUE_CLASS,
    CONTAINER_LOADING_CLASS,
    FIELD_ERROR_CLASS,
    SELECT_ROOT_CLASS,
    resolveFieldSurface,
    resolveFieldSurfaceClasses
} from './field-styles';
import { useIsInFormSectionGroup } from '@/shared/ui/components/FormSection';
import { Description, Label, ListBox, Select, Switch, cn } from '@heroui/react';
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
    const isInFormSectionGroup = useIsInFormSectionGroup();
    const tokenAutocomplete = useFieldAutocomplete({
        field,
        fieldType,
        autocomplete
    });

    const effectiveValue = field.value;
    const isCanvasVariant = variant === 'canvas';
    const surface = resolveFieldSurface(variant, isInFormSectionGroup);
    const surfaceClasses = resolveFieldSurfaceClasses(surface, fieldType, Boolean(label));
    const fieldClass = isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input';
    const selectClass = isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select';
    const textareaClass = isCanvasVariant ? 'form-field-canvas-textarea' : 'form-field-inline-textarea';
    const containerBaseClass = isCanvasVariant ? 'form-field-canvas' : 'form-field-inline';
    const datalistId = (suggestions?.length && !tokenAutocomplete.isEnabled) ? `${field.name}-suggestions` : undefined;

    /*
     * `aria-invalid` is not part of any HeroUI/React-Aria field's prop surface —
     * react-aria's `filterDOMProps` drops unknown `aria-*` — so it is handed to
     * `Select` / `Switch` as `isInvalid`, which is what puts the attribute on the
     * real control. The plain `input` / `textarea` below still take the spread.
     */
    const isInvalid = Boolean(error);
    const describedBy = fieldStatusAriaProps['aria-describedby'];
    const errorMessageId = fieldStatusAriaProps['aria-errormessage'];

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
                    className={cn(selectClass, 'labeled-input', SELECT_ROOT_CLASS)}
                    selectedKey={String(effectiveValue ?? '') || null}
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
                    <Select.Trigger className={surfaceClasses.selectTrigger}>
                        {/*
                          * bravais's trigger showed the selected option's `title`
                          * only; RAC's default children render the whole item, so
                          * a `description` would leak into the trigger.
                          */}
                        <Select.Value className={surfaceClasses.selectValue}>
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

        if(fieldType === 'checkbox'){
            return (
                <Switch
                    id={fieldId}
                    size={surfaceClasses.toggleSize}
                    isSelected={Boolean(effectiveValue)}
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
                    className={cn(fieldClass, textareaClass, surfaceClasses.textareaControl)}
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
                    className={cn(fieldClass, 'labeled-input', surfaceClasses.textControl)}
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

    /*
     * The marker classes the four other modules' stylesheets still select on. They
     * carry no styling of their own any more — `surfaceClasses.container` does —
     * but they stay on the DOM so those overrides keep matching.
     */
    const checkboxContainerMarkers = fieldType === 'checkbox'
        ? 'form-field-inline-checkbox-container checkbox-container'
        : undefined;
    const noLabelContainerMarker = (fieldType !== 'checkbox' && !isCanvasVariant && !label)
        ? 'form-field-inline-no-label'
        : undefined;
    const containerClass = cn(containerBaseClass, checkboxContainerMarkers, noLabelContainerMarker, surfaceClasses.container);

    const labelClass = isCanvasVariant
        ? cn('canvas-form-label', surfaceClasses.label)
        : cn('form-field-inline-label labeled-input-label', surfaceClasses.label);
    const loadingClass = isLoading ? cn('is-loading form-field-loading', CONTAINER_LOADING_CLASS) : '';

    return (
        <div className={cn(containerClass, loadingClass)}>
            {label && (
                <label id={labelId} htmlFor={labelTargetId} className={labelClass}>
                    {label}
                </label>
            )}
            <div ref={tokenAutocomplete.refs.setReference} className={cn('render-input-container', surfaceClasses.controlSlot)}>
                {renderInlineField()}
            </div>

            {tokenAutocomplete.isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <div ref={tokenAutocomplete.refs.setFloating} className={cn('form-field-autocomplete-menu', AUTOCOMPLETE_MENU_CLASS)} data-floating-owner-ids={floatingOwnerIdsAttribute} style={tokenAutocomplete.floatingStyles} {...tokenAutocomplete.getFloatingProps()}>
                        {tokenAutocomplete.options.map((option, index) => (
                            <button
                                type='button'
                                key={`${option.value}-${index}`}
                                className={cn(
                                    'form-field-autocomplete-option',
                                    AUTOCOMPLETE_OPTION_CLASS,
                                    index === tokenAutocomplete.activeIndex && 'is-active',
                                    index === tokenAutocomplete.activeIndex && AUTOCOMPLETE_OPTION_ACTIVE_CLASS
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    tokenAutocomplete.applyOption(option.value);
                                }}
                            >
                                <span className={cn('form-field-autocomplete-option-label', AUTOCOMPLETE_OPTION_LABEL_CLASS)}>{option.label}</span>
                                {option.label !== option.value && (
                                    <span className={cn('form-field-autocomplete-option-value', AUTOCOMPLETE_OPTION_VALUE_CLASS)}>{option.value}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </FloatingPortal>
            )}

            {error && (
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className={cn('form-field-error', FIELD_ERROR_CLASS)}>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default InlineCanvasFieldRenderer;
