import { useCanvasPipelineStore } from '../../store/canvas-pipeline';
import CanvasSearchInput from '../CanvasSearchInput';
import { EmptyState, Typography } from '@heroui/react';
import { useFloatingRoot } from '@/shared/ui/contexts/FloatingRootContext';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const MAX_RESULTS = 12;

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const CanvasPluginSearch = () => {
    const { modifiers } = usePluginSelectors();
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const floatingRoot = useFloatingRoot();

    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const queryRef = useRef('');
    queryRef.current = query;

    const searchInputId = `canvas-plugin-search-${Math.random().toString(36).slice(2)}`;
    const resultsListId = `canvas-plugin-results-${Math.random().toString(36).slice(2)}`;

    const { refs, floatingStyles, context } = useFloating({
        placement: 'bottom',
        open: isOpen,
        onOpenChange: setIsOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
                apply: ({ rects, elements }) => {
                    elements.floating.style.width = `${rects.reference.width}px`;
                }
            })
        ]
    });

    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return modifiers.slice(0, MAX_RESULTS);
        return modifiers
            .filter((m) => m.name.toLowerCase().includes(q))
            .slice(0, MAX_RESULTS);
    }, [modifiers, query]);

    useEffect(() => {
        const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
            if (isEditableTarget(event.target)) return;
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
                event.preventDefault();
                const input = inputRef.current;
                if (input) { input.focus(); input.select(); }
                setIsOpen(true);
                return;
            }
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === 'Backspace' || event.key === 'Delete') {
                if (queryRef.current.length === 0) return;
                event.preventDefault();
                setQuery((prev) => prev.slice(0, -1));
                setIsOpen(true);
                setActiveIndex(-1);
                inputRef.current?.focus();
                return;
            }
            if (event.key.length === 1 && event.key !== ' ') {
                event.preventDefault();
                setQuery((prev) => prev + event.key);
                setIsOpen(true);
                setActiveIndex(-1);
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    useEffect(() => { setActiveIndex(-1); }, [query]);

    const handleSelect = (index: number) => {
        const modifier = results[index];
        if (!modifier) return;
        addStage('analysis-plugin', {
            pluginId: modifier.pluginId,
            argValues: {}
        });
        setQuery('');
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            if (activeIndex < 0 && results.length === 1) { event.preventDefault(); handleSelect(0); return; }
            if (activeIndex >= 0) { event.preventDefault(); handleSelect(activeIndex); }
            return;
        }
        if (event.key === 'Escape') {
            if (isOpen) { event.preventDefault(); setIsOpen(false); inputRef.current?.blur(); }
        }
    };

    const activeOptionId = activeIndex >= 0 && results[activeIndex]
        ? `${resultsListId}-${results[activeIndex].pluginId}`
        : undefined;

    return (
        <div className='w-[clamp(240px,32vw,440px)] min-w-0' ref={refs.setReference} {...getReferenceProps()}>
            <CanvasSearchInput
                ref={inputRef}
                id={searchInputId}
                placeholder='Search plugins…'
                value={query}
                variant='small'
                containerClassName='flex w-full min-h-9 items-center gap-2 rounded-xl px-3 py-1.5'
                className='text-[0.8125rem] leading-[1.25] m-0 h-auto p-0'
                aria-label='Search plugins'
                role='combobox'
                aria-autocomplete='list'
                aria-expanded={isOpen}
                aria-haspopup='listbox'
                aria-controls={isOpen ? resultsListId : undefined}
                aria-activedescendant={activeOptionId}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setActiveIndex(-1); }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
            />
            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <div
                        ref={refs.setFloating}
                        className='max-h-[60vh] min-h-36 overflow-y-auto rounded-xl border border-border bg-surface z-[99999]'
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        {results.length === 0 ? (
                            <div className='flex min-h-36 flex-row items-center justify-center p-4'>
                                <EmptyState>
                                    <Typography.Heading level={3}>
                                        {query ? 'No plugins match' : 'No plugins available'}
                                    </Typography.Heading>
                                    <Typography.Paragraph size='sm'>
                                        {query
                                            ? `Nothing matches "${query.trim()}". Try a different name.`
                                            : 'Install or publish a plugin to see it listed here.'}
                                    </Typography.Paragraph>
                                </EmptyState>
                            </div>
                        ) : (
                            <div className='flex flex-col gap-1 p-2'
                                id={resultsListId}
                                role='listbox'
                                aria-label='Plugin search results'
                            >
                                {results.map((modifier, index) => {
                                    const isActive = index === activeIndex;
                                    const optionId = `${resultsListId}-${modifier.pluginId}`;
                                    return (
                                        <button
                                            key={modifier.pluginId}
                                            id={optionId}
                                            type='button'
                                            role='option'
                                            aria-selected={isActive}
                                            className={isActive ? 'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2 text-left hover:bg-surface-hover bg-surface-hover' : 'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2 text-left hover:bg-surface-hover'}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelect(index)}
                                        >
                                            <span className='text-sm text-muted truncate'>{modifier.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
};

export default CanvasPluginSearch;
