import useFieldAutocomplete from './use-field-autocomplete';
import { buildFieldAccessibilityState } from './field-accessibility';
import { useIsInFormSectionGroup } from '@/shared/ui/components/FormSection';
import { ListBox, Select, Switch, cn } from '@heroui/react';
import { useFloatingLayerRoot } from '@/shared/ui/utils/floating-layer';
import { FloatingPortal } from '@floating-ui/react';
import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';
import type { FieldRendererProps } from '@/shared/contracts/form-field';
import type { FieldTextElement } from './use-field-autocomplete';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import Scrollable from '@/shared/ui/components/Scrollable';
import {
    COMPACT_FIELD_INPUT,
    COMPACT_FIELD_LABEL,
    COMPACT_FIELD_TEXTAREA,
    COMPACT_FIELD_TRIGGER,
    COMPACT_FIELD_VALUE
} from '@/shared/ui/utils/field-density';

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
    const isCheckbox = fieldType === 'checkbox';
    const surface = isCanvasVariant ? 'canvas' : (isInFormSectionGroup ? 'section' : 'inline');
    const collapsesLabelColumn = !isCheckbox && !isCanvasVariant && !label;
    const datalistId = (suggestions?.length && !tokenAutocomplete.isEnabled) ? `${field.name}-suggestions` : undefined;

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
                    className={cn(isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select', 'labeled-input flex-1 min-w-0')}
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
                    <Select.Trigger className={{
                        inline: 'w-full min-h-0 px-3 py-1.5 pe-7 border border-border rounded-lg bg-transparent text-foreground',
                        section: 'w-full h-auto min-h-0 p-0 pe-6 border-0 bg-transparent shadow-none text-muted hover:text-foreground',
                        canvas: cn('w-full', COMPACT_FIELD_TRIGGER)
                    }[surface]}>
                        <Select.Value className={{
                            inline: 'text-sm',
                            section: 'text-sm text-end tabular-nums',
                            canvas: COMPACT_FIELD_VALUE
                        }[surface]}>
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

        if(fieldType === 'checkbox'){
            return (
                <Switch
                    id={fieldId}
                    size={isCanvasVariant ? 'sm' : 'md'}
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
                    className={cn(isCanvasVariant ? 'form-field-canvas-input form-field-canvas-textarea' : 'form-field-inline-input form-field-inline-textarea', {
                        inline: 'flex-1 min-w-0 px-3 py-1.5 border border-border rounded-lg bg-transparent text-foreground text-sm placeholder:text-muted focus:border-accent resize-y min-h-20',
                        section: 'flex-1 min-w-0 px-0 py-1 border-0 bg-transparent text-muted text-sm text-left tabular-nums placeholder:text-muted placeholder:text-left focus:text-foreground resize-y min-h-20',
                        canvas: cn('flex-1 min-w-0', COMPACT_FIELD_TEXTAREA)
                    }[surface])}
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
                    className={cn(isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input', 'labeled-input', {
                        inline: 'flex-1 min-w-0 px-3 py-1.5 border border-border rounded-lg bg-transparent text-foreground text-sm placeholder:text-muted focus:border-accent',
                        section: 'flex-1 min-w-0 px-0 py-1 border-0 bg-transparent text-muted text-sm text-right tabular-nums placeholder:text-muted placeholder:text-right focus:text-foreground',
                        canvas: cn('flex-1 min-w-0', COMPACT_FIELD_INPUT)
                    }[surface])}
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

    return (
        <div className={cn(
            isCanvasVariant ? 'form-field-canvas' : 'form-field-inline',
            isCheckbox && 'form-field-inline-checkbox-container checkbox-container',
            collapsesLabelColumn && 'form-field-inline-no-label',
            collapsesLabelColumn ? {
                inline: 'grid grid-cols-[1fr] items-center gap-3 min-h-[2.375rem]',
                section: 'grid grid-cols-[1fr] items-center gap-3 px-3.5 py-2 min-h-10 border-b border-border last:border-b-0',
                canvas: 'flex flex-row items-center justify-between gap-2 min-h-7'
            }[surface] : {
                inline: 'grid grid-cols-[140px_1fr] items-center gap-3 min-h-[2.375rem]',
                section: 'grid grid-cols-[minmax(88px,40%)_1fr] items-center gap-3 px-3.5 py-2 min-h-10 border-b border-border last:border-b-0',
                canvas: 'flex flex-row items-center justify-between gap-2 min-h-7'
            }[surface],
            isLoading && 'is-loading form-field-loading opacity-70 pointer-events-none'
        )}>
            {label && (
                <label id={labelId} htmlFor={labelTargetId} className={cn(
                    isCanvasVariant ? 'canvas-form-label' : 'form-field-inline-label labeled-input-label',
                    isCheckbox ? {
                        inline: 'shrink-0 text-base font-normal',
                        section: 'shrink-0 text-sm font-normal text-foreground',
                        canvas: cn('w-auto min-w-0 flex-1', COMPACT_FIELD_LABEL)
                    }[surface] : {
                        inline: 'shrink-0 text-base font-normal',
                        section: 'shrink-0 text-sm font-normal text-foreground',
                        canvas: cn('min-w-32 shrink-0', COMPACT_FIELD_LABEL)
                    }[surface]
                )}>
                    {label}
                </label>
            )}
            <div ref={tokenAutocomplete.refs.setReference} className={cn('render-input-container', {
                inline: 'flex items-center justify-end relative w-full min-w-0',
                section: 'flex items-center justify-end relative w-full min-w-0',
                canvas: 'flex items-center justify-end relative w-full min-w-0 max-w-[150px]'
            }[surface])}>
                {renderInlineField()}
            </div>

            {tokenAutocomplete.isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <Scrollable ref={tokenAutocomplete.refs.setFloating} className='form-field-autocomplete-menu popover flex flex-col max-h-[180px] z-[var(--z-floating)]' data-floating-owner-ids={floatingOwnerIdsAttribute} style={tokenAutocomplete.floatingStyles} {...tokenAutocomplete.getFloatingProps()}>
                        {tokenAutocomplete.options.map((option, index) => (
                            <button
                                type='button'
                                key={`${option.value}-${index}`}
                                className={cn(
                                    'form-field-autocomplete-option w-full flex flex-col items-start gap-0.5 min-h-10 px-2 py-1.5 border-0 bg-transparent text-foreground text-left cursor-pointer hover:bg-surface-hover',
                                    index === tokenAutocomplete.activeIndex && 'is-active bg-surface-hover'
                                )}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    tokenAutocomplete.applyOption(option.value);
                                }}
                            >
                                <span className='form-field-autocomplete-option-label text-xs leading-[1.2]'>{option.label}</span>
                                {option.label !== option.value && (
                                    <span className='form-field-autocomplete-option-value text-xs leading-[1.1] text-muted'>{option.value}</span>
                                )}
                            </button>
                        ))}
                    </Scrollable>
                </FloatingPortal>
            )}

            {error && (
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className='form-field-error flex items-center gap-1 text-danger text-xs'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default InlineCanvasFieldRenderer;
