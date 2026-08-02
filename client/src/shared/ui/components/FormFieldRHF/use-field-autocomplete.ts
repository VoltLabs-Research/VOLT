import { matchReferenceWidth } from '@/shared/ui/utils/floating-layer';
import { autoUpdate, flip, offset, shift, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FieldRendererProps } from '@/shared/contracts/form-field';
import type { KeyboardEvent } from 'react';

const DEFAULT_TRIGGER = '{{';
const DEFAULT_MAX_ITEMS = 8;
const NAVIGATION_KEYS = ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'];

export type FieldTextElement = HTMLInputElement | HTMLTextAreaElement;

interface FieldAutocompleteOption {
    value: string;
    label: string;
};

/** Slice of the field value the user is currently completing. */
interface FieldAutocompleteToken {
    start: number;
    end: number;
    query: string;
};

interface UseFieldAutocompleteParams {
    field: FieldRendererProps['field'];
    fieldType: FieldRendererProps['fieldType'];
    autocomplete: FieldRendererProps['autocomplete'];
};

/**
 * Token autocomplete for inline text fields: tracks the `{{token` the caret sits
 * in, filters the offered options and writes the pick back into the value.
 */
const useFieldAutocomplete = ({ field, fieldType, autocomplete }: UseFieldAutocompleteParams) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const [token, setToken] = useState<FieldAutocompleteToken | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const options = useMemo(() => {
        if(!autocomplete?.options?.length) return [];

        return autocomplete.options
            .map((option): FieldAutocompleteOption | null => {
                if(typeof option === 'string' || typeof option === 'number'){
                    const stringValue = String(option);
                    return {
                        value: stringValue,
                        label: stringValue
                    };
                }

                const value = option.value.trim();
                if(!value) return null;

                return {
                    value,
                    label: option.label?.trim() || value
                };
            })
            .filter((option): option is FieldAutocompleteOption => option !== null);
    }, [autocomplete?.options]);

    const trigger = autocomplete?.trigger ?? DEFAULT_TRIGGER;
    const maxItems = autocomplete?.maxItems ?? DEFAULT_MAX_ITEMS;
    const isEnabled = (fieldType === 'input' || fieldType === 'textarea') && options.length > 0;

    const filteredOptions = useMemo(() => {
        if(!token) return [];

        const query = token.query.toLowerCase();
        const matches = options.filter((option) => {
            if(!query) return true;
            return option.value.toLowerCase().includes(query) || option.label.toLowerCase().includes(query);
        });

        return matches.slice(0, maxItems);
    }, [token, options, maxItems]);

    const isOpen = Boolean(token) && filteredOptions.length > 0;

    const handleOpenChange = useCallback((open: boolean) => {
        if(!open){
            setToken(null);
        }
    }, []);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: handleOpenChange,
        placement: 'bottom-start',
        middleware: [
            offset(4),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            matchReferenceWidth()
        ],
        whileElementsMounted: autoUpdate
    });
    const { getFloatingProps } = useInteractions([useDismiss(context)]);

    const syncToken = (target: FieldTextElement) => {
        if(!isEnabled) return;

        const caretPosition = target.selectionStart ?? target.value.length;
        const prefix = target.value.slice(0, caretPosition);
        const triggerIndex = prefix.lastIndexOf(trigger);
        const query = triggerIndex === -1 ? null : prefix.slice(triggerIndex + trigger.length);

        setActiveIndex(0);
        setToken(query === null || query.includes('}}') || query.includes('\n') ? null : {
            start: triggerIndex,
            end: caretPosition,
            query: query.trim()
        });
    };

    const applyOption = (optionValue: string) => {
        if(!token) return;

        const activeField = inputRef.current ?? textareaRef.current;
        const currentValue = activeField?.value ?? String(field.value ?? '');

        field.onChange(`${currentValue.slice(0, token.start)}${optionValue}${currentValue.slice(token.end)}`);
        pendingCaretRef.current = token.start + optionValue.length;
        setToken(null);
        setActiveIndex(0);
    };

    useEffect(() => {
        if(pendingCaretRef.current === null) return;

        const nextCaret = pendingCaretRef.current;
        const target = fieldType === 'textarea' ? textareaRef.current : inputRef.current;
        if(!target){
            pendingCaretRef.current = null;
            return;
        }

        requestAnimationFrame(() => {
            target.focus();
            target.setSelectionRange(nextCaret, nextCaret);
            pendingCaretRef.current = null;
        });
    }, [field.value, fieldType]);

    const handleKeyDown = (event: KeyboardEvent<FieldTextElement>) => {
        if(!isOpen) return;

        if(event.key === 'ArrowDown'){
            event.preventDefault();
            setActiveIndex((previous) => (previous + 1) % filteredOptions.length);
            return;
        }

        if(event.key === 'ArrowUp'){
            event.preventDefault();
            setActiveIndex((previous) => (previous - 1 + filteredOptions.length) % filteredOptions.length);
            return;
        }

        if(event.key === 'Enter' || event.key === 'Tab'){
            event.preventDefault();
            const option = filteredOptions[activeIndex];
            if(option){
                applyOption(option.value);
            }
            return;
        }

        if(event.key === 'Escape'){
            event.preventDefault();
            setToken(null);
        }
    };

    return {
        isEnabled,
        isOpen,
        options: filteredOptions,
        activeIndex,
        inputRef,
        textareaRef,
        refs,
        floatingStyles,
        getFloatingProps,
        applyOption,
        syncToken,
        handleKeyDown,
        handleKeyUp: (event: KeyboardEvent<FieldTextElement>) => {
            if(!isEnabled || NAVIGATION_KEYS.includes(event.key)) return;

            syncToken(event.currentTarget);
        }
    };
};

export default useFieldAutocomplete;
