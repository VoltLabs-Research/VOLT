import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import Container from '@/shared/presentation/components/Container';
import SearchInput from '@/shared/presentation/components/SearchInput';

interface FrameComboboxProps {
    value: number;
    options: number[];
    onChange: (value: number) => void;
    title?: string;
};

const FrameCombobox = ({ value, options, onChange, title }: FrameComboboxProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const floatingRoot = useFloatingRoot();

    const filtered = useMemo(() => {
        if (!query) return options;
        return options.filter((ts) => String(ts).includes(query));
    }, [options, query]);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [
            offset(4),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
                apply({ rects, elements }) {
                    Object.assign(elements.floating.style, {
                        minWidth: `${Math.max(rects.reference.width, 72)}px`
                    });
                },
                padding: 8
            })
        ],
        whileElementsMounted: autoUpdate
    });

    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

    const selectInput = () => {
        inputRef.current?.select();
    };

    const open = useCallback(() => {
        setQuery('');
        setIsOpen(true);
        requestAnimationFrame(selectInput);
    }, []);

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

    let displayValue = String(value ?? '');
    if (isOpen) {
        displayValue = query;
    }

    const createMouseDownHandler = (ts: number) => (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleSelect(ts);
    };

    return (
        <>
            <Container ref={refs.setReference} title={title} {...getReferenceProps()}>
                <SearchInput
                    variant="small"
                    ref={inputRef}
                    containerClassName="form-field-canvas-field"
                    className="form-field-canvas-input--compact"
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={open}
                    onKeyDown={handleKeyDown}
                    placeholder={String(value)}
                    readOnly={!isOpen}
                />
            </Container>

            {isOpen && filtered.length > 0 && (
                <FloatingPortal root={floatingRoot}>
                    <Container
                        ref={refs.setFloating}
                        className="form-field-canvas-dropdown overflow-auto"
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        {filtered.map((ts) => (
                            <Container
                                key={ts}
                                className={`form-field-canvas-option cursor-pointer${ts === value ? ' is-selected' : ''}`}
                                onMouseDown={createMouseDownHandler(ts)}
                            >
                                {ts}
                            </Container>
                        ))}
                    </Container>
                </FloatingPortal>
            )}
        </>
    );
};

export default FrameCombobox;
