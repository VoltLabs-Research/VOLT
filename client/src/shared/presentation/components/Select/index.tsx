import React, { useId, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './Select.css';

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
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => {
        if (!value) return null;
        return options.find((o) => o.value === value) || null;
    }, [options, value]);

    const calculatePosition = useCallback(() => {
        if (!triggerRef.current) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 8;
        const gap = 6;

        let left = rect.left;
        let top = rect.bottom + gap;
        const minWidth = rect.width;

        if (left + minWidth > vw - padding) {
            left = vw - minWidth - padding;
        }

        const estimatedHeight = Math.min(options.length * 48, 300);
        if (top + estimatedHeight > vh - padding) {
            top = rect.top - estimatedHeight - gap;
        }

        if (left < padding) left = padding;

        setDropdownStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            minWidth: `${minWidth}px`,
            zIndex: 9999
        });
    }, [options.length]);

    const handleToggle = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (disabled) return;

        if (!isOpen) {
            calculatePosition();
        }
        setIsOpen((prev) => !prev);
    }, [disabled, isOpen, calculatePosition]);

    const handleSelect = useCallback((e: React.MouseEvent, optValue: string) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(optValue);
        setIsOpen(false);
    }, [onChange]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollEnd) return;

        const target = e.currentTarget;
        const threshold = 50;
        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

        if (isNearBottom && !isLoading) {
            onScrollEnd();
        }
    }, [onScrollEnd, isLoading]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node | null;
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];

            if (
                (target && triggerRef.current?.contains(target)) ||
                (target && dropdownRef.current?.contains(target)) ||
                (triggerRef.current && path.includes(triggerRef.current)) ||
                (dropdownRef.current && path.includes(dropdownRef.current))
            ) {
                return;
            }

            setIsOpen(false);
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleReposition = () => calculatePosition();

        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);

        return () => {
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
        };
    }, [isOpen, calculatePosition]);

    useEffect(() => {
        const dropdownEl = dropdownRef.current as any;
        if (!dropdownEl) return;

        if (isOpen) {
            dropdownEl.showPopover?.();
            return;
        }

        dropdownEl.hidePopover?.();
    }, [isOpen]);

    const dropdown = isOpen ? createPortal(
        <div
            ref={dropdownRef}
            popover='manual'
            className='select-dropdown y-auto glass-bg'
            style={{ ...dropdownStyle, zIndex: 2147483647 }}
            onScroll={handleScroll}
        >
            {options.map((opt) => {
                const isSelected = opt.value === value;

                return (
                    <div
                        key={opt.value}
                        className={`select-option d-flex items-center content-between gap-05 ${optionClassName} ${isSelected ? 'selected' : ''} color-primary cursor-pointer`}
                        onClick={(e) => handleSelect(e, opt.value)}
                    >
                        <Container className='d-flex column'>
                            <Paragraph className='font-size-2'>
                                {opt.title}
                            </Paragraph>

                            {opt.description && (
                                <Paragraph className='select-option-description color-muted font-size-1'>
                                    {opt.description}
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

                        {renderOptionAction?.(opt, isSelected)}
                    </div>
                );
            })}

            {isLoading && (
                <div className='select-option-loading d-flex items-center content-center'>
                    <Paragraph className='color-muted font-size-1'>Loading...</Paragraph>
                </div>
            )}
        </div>,
        triggerRef.current?.closest('dialog') || document.body
    ) : null;

    return (
        <>
            <button
                ref={triggerRef}
                id={uid}
                type='button'
                className={`select-trigger d-flex items-center gap-05 ${onDark ? 'on-dark' : ''} ${className} ${isOpen ? 'open' : ''} overflow-hidden cursor-pointer`}
                style={style}
                onClick={handleToggle}
                disabled={disabled}
                aria-haspopup='listbox'
                aria-expanded={isOpen}
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

            {dropdown}
        </>
    );
};

export default Select;
