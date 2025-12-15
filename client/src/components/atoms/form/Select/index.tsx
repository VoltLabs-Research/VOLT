import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoExitOutline } from 'react-icons/io5';
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
    placeholder?: string;
    onDark?: boolean;
    showSelectionIcon?: boolean;
    className?: string;
    optionClassName?: string;
    maxListWidth?: number;
    renderInPortal?: boolean;
    onLeaveTeam?: (value: string) => void;
}

const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    disabled = false,
    onDark = false,
    placeholder = 'Select...',
    className = '',
    optionClassName = '',
    showSelectionIcon = true,
    maxListWidth = 480,
    renderInPortal = false,
    onLeaveTeam
}) => {
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
    const typeaheadBuffer = useRef<string>('');
    const typeaheadTimer = useRef<number | null>(null);

    const uid = useId();
    const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

    const toggle = () => {
        if (disabled) return;
        setOpen((v) => !v);
    };

    useEffect(() => {
        const onDocumentMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!rootRef.current) return;
            const clickedInsideRoot = rootRef.current.contains(target);
            const clickedInsideList = !!(listRef.current && listRef.current.contains(target));
            if (!(clickedInsideRoot || clickedInsideList)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', onDocumentMouseDown);
        };
    }, []);

    useEffect(() => {
        if (open) {
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
            setTimeout(() => {
                triggerRef.current?.scrollIntoView({ block: 'nearest' });
            }, 0);
        }
    }, [open, selectedIndex]);
    // Compute portal position when open
    useEffect(() => {
        if (!open || !renderInPortal) return;
        const updatePosition = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            const left = Math.max(8, rect.left);
            const top = rect.bottom + 6;
            const availableRight = window.innerWidth - left - 8;
            const computedMaxWidth = Math.max(180, Math.min(maxListWidth, availableRight));
            const minWidth = Math.max(180, Math.floor(rect.width));
            setPortalStyle({ position: 'fixed', top, left, minWidth: `${minWidth}px`, maxWidth: `${computedMaxWidth}px`, zIndex: 2147483647 });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, renderInPortal, maxListWidth]);

    useEffect(() => {
        if (!open) return;
        const optionNodes = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
        if (!optionNodes || highlightedIndex < 0) return;
        optionNodes[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [open, highlightedIndex]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        const max = options.length - 1;
        const move = (delta: number) => {
            setHighlightedIndex((i) => {
                const next = i < 0 ? 0 : Math.min(max, Math.max(0, i + delta));
                return next;
            });
        };

        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                if (!open) {
                    setOpen(true);
                } else if (highlightedIndex >= 0) {
                    onChange(options[highlightedIndex].value);
                    setOpen(false);
                }
                return;
            case 'ArrowDown':
                e.preventDefault();
                if (!open) setOpen(true);
                move(1);
                return;
            case 'ArrowUp':
                e.preventDefault();
                if (!open) setOpen(true);
                move(-1);
                return;
            case 'Home':
                e.preventDefault();
                setHighlightedIndex(0);
                return;
            case 'End':
                e.preventDefault();
                setHighlightedIndex(max);
                return;
            case 'Escape':
                if (open) {
                    e.preventDefault();
                    setOpen(false);
                }
                return;
            default:
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const now = Date.now();
                    if (typeaheadTimer.current === null || now - typeaheadTimer.current > 500) {
                        typeaheadBuffer.current = '';
                    }
                    typeaheadTimer.current = now;
                    typeaheadBuffer.current += e.key.toLowerCase();
                    const idx = options.findIndex((o) => o.title.toLowerCase().startsWith(typeaheadBuffer.current));
                    if (idx >= 0) {
                        if (!open) setOpen(true);
                        setHighlightedIndex(idx);
                    }
                }
        }
    };

    const listboxId = `${uid}-listbox`;
    const activeId = highlightedIndex >= 0 ? `${uid}-opt-${highlightedIndex}` : undefined;

    return (
        <div
            ref={rootRef}
            className={`rh-select ${open ? 'is-open' : ''} ${onDark ? 'on-dark' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
            data-open={open}
            data-disabled={disabled}
        >
            <button
                ref={triggerRef}
                type="button"
                className="rh-select-trigger d-flex items-center gap-05 w-max"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={toggle}
                onKeyDown={onKeyDown}
                disabled={disabled}
            >
                <span
                    className={`rh-select-value ${!selected ? 'is-placeholder' : ''}`}
                    title={selected ? selected.title : ''}
                >
                    {selected ? selected.title : placeholder}
                </span>
                <svg
                    className="rh-select-chevron"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
            </button>

            {open && (!renderInPortal ? (
                <div
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    aria-activedescendant={activeId}
                    className="rh-select-list"
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    style={{ ['--select-list-max-width' as any]: `${maxListWidth}px` }}
                >
                    {options.map((opt, i) => {
                        const isSelected = i === selectedIndex;
                        const isActive = i === highlightedIndex;
                        const isHovered = i === hoveredIndex;
                        return (
                            <div
                                id={`${uid}-opt-${i}`}
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                className={`select-option-container d-flex items-center content-between gap-05 ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${optionClassName}`}
                                onMouseEnter={() => {
                                    setHighlightedIndex(i);
                                    setHoveredIndex(i);
                                }}
                                onMouseLeave={() => setHoveredIndex(-1)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <span className="select-option-title d-flex column" title={opt.title}>
                                    {opt.title}
                                    {opt.description && (
                                        <span className="select-option-description">
                                            {opt.description}
                                        </span>
                                    )}
                                </span>
                                {isSelected && !isHovered && showSelectionIcon && (
                                    <svg className="d-flex content-center items-center select-option-check" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                )}
                                {(isSelected || isHovered) && isHovered && onLeaveTeam && (
                                    <button
                                        className="d-flex content-center items-center select-option-leave-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLeaveTeam(opt.value);
                                            setOpen(false);
                                        }}
                                        title="Leave this team"
                                        aria-label="Leave this team"
                                    >
                                        <IoExitOutline size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : createPortal(
                <div
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    aria-activedescendant={activeId}
                    className="rh-select-list"
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    style={{ ['--select-list-max-width' as any]: `${maxListWidth}px`, ...(portalStyle || {}) }}
                >
                    {options.map((opt, i) => {
                        const isSelected = i === selectedIndex;
                        const isActive = i === highlightedIndex;
                        const isHovered = i === hoveredIndex;
                        return (
                            <div
                                id={`${uid}-opt-${i}`}
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                className={`select-option-container d-flex items-center content-between gap-05 ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${optionClassName}`}
                                onMouseEnter={() => {
                                    setHighlightedIndex(i);
                                    setHoveredIndex(i);
                                }}
                                onMouseLeave={() => setHoveredIndex(-1)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <span className="select-option-title d-flex column" title={opt.title}>
                                    {opt.title}
                                    {opt.description && (
                                        <span className="select-option-description">
                                            {opt.description}
                                        </span>
                                    )}
                                </span>
                                {isSelected && !isHovered && (
                                    <svg className="d-flex content-center items-center select-option-check" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                )}
                                {(isSelected || isHovered) && isHovered && onLeaveTeam && (
                                    <button
                                        className="d-flex content-center items-center select-option-leave-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLeaveTeam(opt.value);
                                            setOpen(false);
                                        }}
                                        title="Leave this team"
                                        aria-label="Leave this team"
                                    >
                                        <IoExitOutline size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>, document.body))}
        </div>
    );
};

export default Select;
