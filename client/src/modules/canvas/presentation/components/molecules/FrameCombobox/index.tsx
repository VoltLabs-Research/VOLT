import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Container from '@/shared/presentation/components/Container';

interface FrameComboboxProps {
    value: number;
    options: number[];
    onChange: (value: number) => void;
    title?: string;
}

const FrameCombobox = ({ value, options, onChange, title }: FrameComboboxProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const filtered = useMemo(() => {
        if (!query) return options;
        return options.filter((ts) => String(ts).includes(query));
    }, [options, query]);

    const calculatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const gap = 4;
        const estimatedHeight = Math.min(filtered.length * 28 + 8, 180);
        let top = rect.bottom + gap;
        if (top + estimatedHeight > vh - 8) {
            top = rect.top - estimatedHeight - gap;
        }
        setDropdownStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${rect.left}px`,
            minWidth: `${Math.max(rect.width, 72)}px`,
            zIndex: 9999
        });
    }, [filtered.length]);

    const open = useCallback(() => {
        setQuery('');
        setIsOpen(true);
        calculatePosition();
        requestAnimationFrame(() => inputRef.current?.select());
    }, [calculatePosition]);

    const close = useCallback(() => {
        setIsOpen(false);
        setQuery('');
    }, []);

    const handleSelect = useCallback((ts: number) => {
        onChange(ts);
        close();
    }, [onChange, close]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            close();
            return;
        }
        if (e.key === 'Enter') {
            const exact = options.find((ts) => String(ts) === query);
            if (exact !== undefined) {
                handleSelect(exact);
            } else if (filtered.length === 1) {
                handleSelect(filtered[0]);
            }
        }
    }, [close, options, query, filtered, handleSelect]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
            close();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, close]);

    useEffect(() => {
        if (!isOpen) return;
        const reposition = () => calculatePosition();
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [isOpen, calculatePosition]);

    const dropdown = isOpen && filtered.length > 0 ? createPortal(
        <Container
            ref={dropdownRef}
            className="form-field-canvas-dropdown overflow-auto"
            style={dropdownStyle}
        >
            {filtered.map((ts) => (
                <Container
                    key={ts}
                    className={`form-field-canvas-option cursor-pointer${ts === value ? ' is-selected' : ''}`}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(ts);
                    }}
                >
                    {ts}
                </Container>
            ))}
        </Container>,
        document.body
    ) : null;

    return (
        <>
            <Container
                ref={containerRef}
                className={`form-field-canvas-field d-flex items-center`}
                title={title}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="form-field-canvas-input form-field-canvas-input--compact"
                    value={isOpen ? query : value}
                    onChange={handleInputChange}
                    onFocus={open}
                    onKeyDown={handleKeyDown}
                    placeholder={String(value)}
                    readOnly={!isOpen}
                />
            </Container>
            {dropdown}
        </>
    );
};

export default FrameCombobox;
