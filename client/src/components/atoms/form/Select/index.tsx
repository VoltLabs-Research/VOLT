import React, { useId, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IoExitOutline } from 'react-icons/io5';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import './Select.css';

export interface SelectOption {
    value: string;
    title: string;
    description?: string;
}

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
    onLeaveTeam?: (value: string) => void;
}

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
    onLeaveTeam
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

        // Check if dropdown would overflow right
        if (left + minWidth > vw - padding) {
            left = vw - minWidth - padding;
        }

        // Check if dropdown would overflow bottom - show above if needed
        const estimatedHeight = Math.min(options.length * 48, 300);
        if (top + estimatedHeight > vh - padding) {
            top = rect.top - estimatedHeight - gap;
        }

        // Ensure left is not negative
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

    const handleLeaveTeam = useCallback((
        e: React.MouseEvent<HTMLSpanElement | HTMLDivElement>,
        teamId: string
    ) => {
        e.preventDefault();
        e.stopPropagation();
        onLeaveTeam?.(teamId);
    }, [onLeaveTeam]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                triggerRef.current?.contains(target) ||
                dropdownRef.current?.contains(target)
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

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Recalculate position on scroll/resize
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

    const dropdown = isOpen ? createPortal(
        <div
            ref={dropdownRef}
            className="volt-select-dropdown"
            style={dropdownStyle}
        >
            {options.map((opt) => {
                const isSelected = opt.value === value;

                return (
                    <div
                        key={opt.value}
                        className={`volt-select-option d-flex items-center content-between gap-05 ${optionClassName} ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => handleSelect(e, opt.value)}
                    >
                        <Container className='d-flex column'>
                            <Paragraph className='font-size-2'>
                                {opt.title}
                            </Paragraph>

                            {opt.description && (
                                <Paragraph className='volt-select-option-description color-muted font-size-1'>
                                    {opt.description}
                                </Paragraph>
                            )}
                        </Container>

                        {showSelectionIcon && isSelected && (
                            <svg
                                className='volt-select-option-check'
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

                        {onLeaveTeam && (
                            <Container
                                className='volt-select-option-leave color-muted'
                                title='Leave'
                                onClick={(e: React.MouseEvent<HTMLDivElement>) => handleLeaveTeam(e, opt.value)}
                            >
                                <IoExitOutline size={16} />
                            </Container>
                        )}
                    </div>
                );
            })}
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button
                ref={triggerRef}
                id={uid}
                type='button'
                className={`volt-select-trigger d-flex items-center gap-05 ${onDark ? 'on-dark' : ''} ${className} ${isOpen ? 'open' : ''}`}
                style={style}
                onClick={handleToggle}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className='volt-select-value'>
                    {selectedOption ? selectedOption.title : (
                        <span className='color-text-muted'>{placeholder}</span>
                    )}
                </span>

                <svg
                    className={`volt-select-chevron ${isOpen ? 'rotated' : ''}`}
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
