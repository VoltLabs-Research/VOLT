import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './Select.css';
import { useFloating, useClick, useDismiss, useRole, useListNavigation, useTypeahead, useInteractions, FloatingPortal, FloatingFocusManager, offset, flip, shift, size, autoUpdate } from '@floating-ui/react';
import { useId, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';

export interface SelectOption {
    value: string;
    title: string;
    description?: string;
};

export interface SelectProps {
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
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
};

const Select = ({
    options,
    value,
    onChange,
    disabled = false,
    onDark = false,
    placeholder = 'Select...',
    className = '',
    style,
    optionClassName = '',
    showSelectionIcon = true,
    isLoading = false,
    onScrollEnd,
    renderOptionAction
}: SelectProps) => {
    const uid = useId();
    const floatingRoot = useFloatingRoot();
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const listRef = useRef<Array<HTMLElement | null>>([]);
    const listContentRef = useRef<Array<string | null>>([]);

    const selectedOption = useMemo(() => {
        if (!value) return null;
        return options.find((option) => option.value === value) || null;
    }, [options, value]);

    const selectedIndex = useMemo(() => {
        if (!value) {
            return null;
        }

        const optionIndex = options.findIndex((option) => option.value === value);

        if (optionIndex < 0) {
            return null;
        }

        return optionIndex;
    }, [options, value]);

    listContentRef.current = options.map((option) => option.title);

    useEffect(() => {
        if (!isOpen) {
            setActiveIndex(null);
            return;
        }

        if (selectedIndex !== null) {
            setActiveIndex(selectedIndex);
            return;
        }

        if (options.length > 0) {
            setActiveIndex(0);
        }
    }, [isOpen, options.length, selectedIndex]);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [
            offset(6),
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

    const click = useClick(context);
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
        onMatch: setActiveIndex
    });

    const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
        click,
        dismiss,
        role,
        listNavigation,
        typeahead
    ]);

    const handleSelect = useCallback((optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    }, [onChange]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollEnd) return;

        const target = event.currentTarget;
        const threshold = 50;
        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

        if (isNearBottom && !isLoading) {
            onScrollEnd();
        }
    }, [onScrollEnd, isLoading]);

    return (
        <>
            <button
                ref={refs.setReference}
                id={uid}
                type='button'
                className={`select-trigger d-flex items-center gap-05 ${onDark ? 'on-dark' : ''} ${className} ${isOpen ? 'open' : ''} overflow-hidden cursor-pointer`}
                style={style}
                disabled={disabled}
                aria-haspopup='listbox'
                aria-expanded={isOpen}
                {...getReferenceProps()}
            >
                <span className='select-value overflow-hidden'>
                    {selectedOption ? selectedOption.title : (
                        <span className='color-text-muted'>{placeholder}</span>
                    )}
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

            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <FloatingFocusManager context={context} modal={false}>
                        <div
                            ref={refs.setFloating}
                            className='select-dropdown y-auto glass-bg'
                            style={floatingStyles}
                            onScroll={handleScroll}
                            {...getFloatingProps()}
                        >
                            {options.map((option, index) => {
                                const isSelected = option.value === value;

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
                                            onKeyDown: (event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    handleSelect(option.value);
                                                }
                                            }
                                        })}
                                    >
                                        <Container className='d-flex column'>
                                            <Paragraph className='font-size-2'>
                                                {option.title}
                                            </Paragraph>

                                            {option.description && (
                                                <Paragraph className='select-option-description color-muted font-size-1'>
                                                    {option.description}
                                                </Paragraph>
                                            )}
                                        </Container>

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
                            })}

                            {isLoading && (
                                <div className='select-option-loading d-flex items-center content-center'>
                                    <Paragraph className='color-muted font-size-1'>Loading...</Paragraph>
                                </div>
                            )}
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
};

export default Select;
