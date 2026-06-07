import SearchInput from '@/shared/presentation/primitives/SearchInput';
import { matchReferenceWidth, useFloatingLayerRoot } from './floating-layer';
import './Select.css';
import { useFloating, useClick, useDismiss, useRole, useListNavigation, useTypeahead, useInteractions, FloatingPortal, FloatingFocusManager, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { forwardRef, useId, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';

export interface SelectOption {
    value: string;
    title: string;
    description?: string;
};

export interface SelectProps {
    options: SelectOption[];
    id?: string;
    value?: string | null;
    onChange?: (value: string) => void;
    disabled?: boolean;
    onDark?: boolean;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    optionClassName?: string;
    showSelectionIcon?: boolean;
    isLoading?: boolean;
    onScrollEnd?: () => void;
    renderOptionAction?: (option: SelectOption, isSelected: boolean) => React.ReactNode;
    isEditable?: boolean;
    inputClassName?: string;
    title?: string;
    onFocusCapture?: React.FocusEventHandler<HTMLElement>;
    /** Multi-select mode */
    isMulti?: boolean;
    /** Currently selected values in multi-select mode */
    selectedValues?: string[];
    /** Callback when multi-select values change */
    onMultiChange?: (values: string[]) => void;
    /** "All" option rendered as the first item in multi-select */
    allOption?: { value: string; title: string };
    /** Custom trigger label for multi-select */
    renderTriggerLabel?: (selectedCount: number, total: number) => string;
    /** Render a search input inside the dropdown body */
    hasSearch?: boolean;
    /** Placeholder for the dropdown search input */
    searchPlaceholder?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    'aria-errormessage'?: string;
};

const Select = forwardRef<HTMLButtonElement | HTMLInputElement, SelectProps>(({
    options,
    id,
    value = null,
    onChange,
    disabled = false,
    onDark = false,
    placeholder = 'Select…',
    className = '',
    style,
    optionClassName = '',
    showSelectionIcon = true,
    isLoading = false,
    onScrollEnd,
    renderOptionAction,
    isEditable = false,
    inputClassName = '',
    title,
    onFocusCapture,
    isMulti = false,
    selectedValues,
    onMultiChange,
    allOption,
    renderTriggerLabel,
    hasSearch = false,
    searchPlaceholder = 'Search…',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-errormessage': ariaErrorMessage
}, ref) => {
    const uid = useId();
    const { floatingRoot, floatingOwnerIdsAttribute } = useFloatingLayerRoot();
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const listRef = useRef<Array<HTMLElement | null>>([]);
    const listContentRef = useRef<Array<string | null>>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedValuesSet = useMemo(() => new Set(selectedValues ?? []), [selectedValues]);

    const selectedOption = useMemo(() => {
        if (!value) return null;
        return options.find((option) => option.value === value) || null;
    }, [options, value]);

    const filteredOptions = useMemo(() => {
        if ((!isEditable && !hasSearch) || !searchQuery) return options;
        const lowerQuery = searchQuery.toLowerCase();
        return options.filter((option) => option.title.toLowerCase().includes(lowerQuery));
    }, [options, isEditable, hasSearch, searchQuery]);

    const displayOptions = useMemo(() => {
        if (isMulti && allOption) {
            return [{ value: allOption.value, title: allOption.title }, ...filteredOptions];
        }
        return filteredOptions;
    }, [isMulti, allOption, filteredOptions]);

    const selectedIndex = useMemo(() => {
        if (isMulti) return null;
        if (!value) return null;
        const optionIndex = displayOptions.findIndex((option) => option.value === value);
        if (optionIndex < 0) return null;
        return optionIndex;
    }, [isMulti, displayOptions, value]);

    listContentRef.current = displayOptions.map((option) => option.title);

    useEffect(() => {
        if (!isOpen) {
            setActiveIndex(null);
            setSearchQuery('');
            return;
        }

        if (selectedIndex !== null) {
            setActiveIndex(selectedIndex);
            return;
        }

        if (displayOptions.length > 0) {
            setActiveIndex(0);
        }
    }, [isOpen, displayOptions.length, selectedIndex]);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [
            offset(6),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            matchReferenceWidth()
        ],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context, { keyboardHandlers: !isEditable });
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'listbox' });
    const listNavigation = useListNavigation(context, {
        listRef,
        activeIndex,
        selectedIndex: selectedIndex ?? undefined,
        onNavigate: setActiveIndex,
        loop: true
    });
    const typeahead = useTypeahead(context, {
        listRef: listContentRef,
        activeIndex,
        selectedIndex: selectedIndex ?? undefined,
        onMatch: setActiveIndex,
        enabled: !isEditable && !isMulti
    });

    const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
        click,
        dismiss,
        role,
        listNavigation,
        typeahead
    ]);

    const handleSelect = useCallback((optionValue: string) => {
        if (isMulti) {
            if (allOption && optionValue === allOption.value) {
                onMultiChange?.([]);
            } else {
                const currentValues = selectedValues ?? [];
                const isSelected = currentValues.includes(optionValue);
                const nextValues = isSelected
                    ? currentValues.filter((v) => v !== optionValue)
                    : [...currentValues, optionValue];
                onMultiChange?.(nextValues);
            }
            return;
        }
        onChange?.(optionValue);
        setIsOpen(false);
    }, [isMulti, allOption, selectedValues, onMultiChange, onChange]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollEnd) return;

        const target = event.currentTarget;
        const threshold = 50;
        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

        if (isNearBottom && !isLoading) {
            onScrollEnd();
        }
    }, [onScrollEnd, isLoading]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
    }, [isOpen]);

    const handleInputFocus = useCallback(() => {
        setSearchQuery('');
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.select());
    }, []);

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex !== null && filteredOptions[activeIndex]) {
                handleSelect(filteredOptions[activeIndex].value);
            } else if (filteredOptions.length === 1) {
                handleSelect(filteredOptions[0].value);
            }
            return;
        }

        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchQuery('');
        }
    }, [activeIndex, filteredOptions, handleSelect]);

    const setInputReference = useCallback((node: HTMLInputElement | null) => {
        refs.setReference(node);
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            (ref as React.MutableRefObject<HTMLButtonElement | HTMLInputElement | null>).current = node;
        }
    }, [refs, ref]);

    const inputDisplayValue = isOpen ? searchQuery : (selectedOption?.title ?? '');

    const multiTriggerLabel = useMemo(() => {
        const count = selectedValues?.length ?? 0;
        if (renderTriggerLabel) {
            return renderTriggerLabel(count, options.length);
        }
        if (count === 0) return placeholder;
        return `${count} selected`;
    }, [selectedValues, renderTriggerLabel, options.length, placeholder]);

    const renderOption = (option: SelectOption, index: number) => {
        let isSelected: boolean;
        if (isMulti) {
            if (allOption && option.value === allOption.value) {
                isSelected = (selectedValues?.length ?? 0) === 0;
            } else {
                isSelected = selectedValuesSet.has(option.value);
            }
        } else {
            isSelected = option.value === value;
        }

        const handleOptionKeyDown = (event: React.KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            event.preventDefault();
            handleSelect(option.value);
        };

        return (
            <div
                key={option.value}
                ref={(node) => { listRef.current[index] = node; }}
                role='option'
                tabIndex={activeIndex === index ? 0 : -1}
                aria-selected={isSelected}
                className={`select-option d-flex items-center content-between gap-05 ${optionClassName} ${isSelected ? 'selected' : ''} ${activeIndex === index ? 'active' : ''} color-primary cursor-pointer`}
                {...getItemProps({
                    onClick: () => handleSelect(option.value),
                    onKeyDown: handleOptionKeyDown
                })}
            >
                <div className='d-flex column'>
                    <p className='font-size-2'>
                        {option.title}
                    </p>

                    {option.description && (
                        <p className='select-option-description color-muted font-size-1'>
                            {option.description}
                        </p>
                    )}
                </div>

                {showSelectionIcon && isSelected && (
                    <svg
                        className='select-option-check color-muted'
                        width='16'
                        height='16'
                        viewBox='0 0 24 24'
                        aria-hidden='true'
                    >
                        <path
                            d='M20 6L9 17l-5-5'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                        />
                    </svg>
                )}

                {renderOptionAction?.(option, isSelected)}
            </div>
        );
    };

    const renderTrigger = () => {
        const triggerAriaProps = {
            'aria-haspopup': 'listbox' as const,
            'aria-expanded': isOpen,
            'aria-label': ariaLabel,
            'aria-labelledby': ariaLabelledBy,
            'aria-describedby': ariaDescribedBy,
            'aria-invalid': ariaInvalid,
            'aria-errormessage': ariaErrorMessage
        };

        if (isEditable) {
            return (
                <input
                    ref={setInputReference}
                    id={id ?? uid}
                    type='text'
                    value={inputDisplayValue}
                    placeholder={placeholder}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleInputKeyDown}
                    className={`select-trigger select-trigger--editable ${className} ${inputClassName} ${isOpen ? 'open' : ''}`}
                    style={style}
                    disabled={disabled}
                    title={title}
                    {...triggerAriaProps}
                    onFocusCapture={onFocusCapture}
                    {...getReferenceProps()}
                />
            );
        }

        const label = isMulti ? multiTriggerLabel : (
            selectedOption ? selectedOption.title : (
                <span className='color-muted'>{placeholder}</span>
            )
        );

        const setButtonReference = (node: HTMLButtonElement | null) => {
            refs.setReference(node);
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref) {
                (ref as React.MutableRefObject<HTMLButtonElement | HTMLInputElement | null>).current = node;
            }
        };

        return (
            <button
                ref={setButtonReference}
                id={id ?? uid}
                type='button'
                className={`select-trigger d-flex items-center gap-05 ${onDark ? 'on-dark' : ''} ${className} ${isOpen ? 'open' : ''} overflow-hidden cursor-pointer`}
                style={style}
                disabled={disabled}
                title={title}
                {...triggerAriaProps}
                onFocusCapture={onFocusCapture}
                {...getReferenceProps()}
            >
                <span className='select-value overflow-hidden'>
                    {label}
                </span>

                <svg
                    className={`select-chevron ${isOpen ? 'rotated' : ''}`}
                    width='18'
                    height='18'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                >
                    <path
                        d='M7 10l5 5 5-5'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                    />
                </svg>
            </button>
        );
    };

    return (
        <>
            {renderTrigger()}

            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <FloatingFocusManager context={context} modal={false}>
                        <div
                            ref={refs.setFloating}
                            className='select-dropdown y-auto glass-bg'
                            data-floating-owner-ids={floatingOwnerIdsAttribute}
                            style={floatingStyles}
                            onScroll={handleScroll}
                            {...getFloatingProps()}
                        >
                            {hasSearch && (
                                <SearchInput
                                    variant='small'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    aria-label='Search options'
                                    containerClassName='select-dropdown-search'
                                />
                            )}

                            {displayOptions.map(renderOption)}

                            {isLoading && (
                                <div className='select-option-loading d-flex items-center content-center'>
                                    <p className='color-muted font-size-1'>Loading…</p>
                                </div>
                            )}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
});

Select.displayName = 'Select';

export default Select;
