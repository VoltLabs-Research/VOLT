import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import './Select.css';

export interface SelectOption{
    value: string;
    title: string;
}

export interface SelectProps{
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    optionClassName?: string;
}

const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    disabled = false,
    placeholder = 'Select...',
    className = '',
    optionClassName = ''
}) => {
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const typeaheadBuffer = useRef<string>('');
    const typeaheadTimer = useRef<number | null>(null);

    const uid = useId();
    const selectedIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

    const toggle = () => {
        if(disabled) return;
        setOpen((v) => !v);
    };
    
    useEffect(() => {
        const onDocumentMouseDown = (e: MouseEvent) => {
            if(!rootRef.current) return;
            if(!rootRef.current.contains(e.target as Node)) setOpen(false);
        };

        document.addEventListener('mousedown', onDocumentMouseDown);
        return () => {
            document.removeEventListener('mousedown', onDocumentMouseDown);
        };
    }, []);

    useEffect(() => {
        if(open){
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
            setTimeout(() => {
                triggerRef.current?.scrollIntoView({ block: 'nearest' })
            }, 0);
        }
    }, [open, selectedIndex]);

    useEffect(() => {
        if(!open) return;
        const optionNodes = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
        if(!optionNodes || highlightedIndex < 0) return;
        optionNodes[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [open, highlightedIndex]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if(disabled) return;

        const max = options.length - 1;
        const move = (delta: number) => {
            setHighlightedIndex((i) => {
                const next = i < 0 ? 0 : Math.min(max, Math.max(0, i + delta));
                return next;
            });
        };

        switch(e.key){
            case ' ':
            case 'Enter':
                e.preventDefault();
                if(!open){
                    setOpen(true);
                }else if(highlightedIndex >= 0){
                    onChange(options[highlightedIndex].value);
                    setOpen(false);
                }
                return;
            case 'ArrowDown':
                e.preventDefault();
                if(!open) setOpen(true);
                move(1);
                return;
            case 'ArrowUp':
                e.preventDefault();
                if(!open) setOpen(true);
                move(-1);
                return;
            case 'Home':
                e.preventDefault();
                setHighlightedIndex(0);
                return;
            case 'End':
                e.preventDefault();
                setHighlightedIndex(max)
                return;
            case 'Escape':
                if(open){
                    e.preventDefault();
                    setOpen(false);
                }
                return;
            default:
                if(e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
                    const now = Date.now();
                    if(typeaheadTimer.current === null || now - typeaheadTimer.current > 500){
                        typeaheadBuffer.current = '';
                    }
                    typeaheadTimer.current = now;
                    typeaheadBuffer.current += e.key.toLowerCase();
                    const idx = options.findIndex((o) => o.title.toLowerCase().startsWith(typeaheadBuffer.current));
                    if(idx >= 0){
                        if(!open) setOpen(true);
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
        className={`rh-select ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
        data-open={open}
        data-disabled={disabled}
        >
            <button
                ref={triggerRef}
                type="button"
                className="rh-select-trigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={toggle}
                onKeyDown={onKeyDown}
                disabled={disabled}
            >
                <span
                    className={`rh-select-value ${!selected ? "is-placeholder" : ""}`}
                    title={selected ? selected.title : ""}
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

            {open && (
                <div
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    aria-activedescendant={activeId}
                    className="rh-select-list"
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                >
                    {options.map((opt, i) => {
                        const isSelected = i === selectedIndex;
                        const isActive = i === highlightedIndex;
                        return (
                            <div
                                id={`${uid}-opt-${i}`}
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                className={`select-option-container ${isSelected ? "is-selected" : ""} ${isActive ? "is-active" : ""} ${optionClassName}`}
                                onMouseEnter={() => setHighlightedIndex(i)}
                                onMouseDown={(e) => e.preventDefault()} 
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <span className="select-option-title" title={opt.title}>
                                    {opt.title}
                                </span>
                                {isSelected && (
                                    <svg className="select-option-check" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Select;