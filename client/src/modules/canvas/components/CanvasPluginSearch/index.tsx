import { useCanvasPipelineStore } from '../../stores/canvas-pipeline';
import { EmptyState, Row, SearchInput, Stack, Surface, Text } from '@voltstack/bravais';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { autoUpdate, flip, FloatingPortal, offset, shift, size, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import './CanvasPluginSearch.css';

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
        addStage('analysis-plugin', { pluginId: modifier.pluginId, argValues: {} });
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
        <div className='canvas-plugin-search-wrapper' ref={refs.setReference} {...getReferenceProps()}>
            <SearchInput
                ref={inputRef}
                id={searchInputId}
                placeholder='Search plugins…'
                value={query}
                variant='small'
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
                    <Surface
                        variant='glass'
                        radius='md'
                        overflow='y-auto'
                        ref={refs.setFloating}
                        className='canvas-plugin-search-results panel-floating'
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        {results.length === 0 ? (
                            <Row justify='center' className='canvas-plugin-search-empty'>
                                <EmptyState
                                    title={query ? 'No plugins match' : 'No plugins available'}
                                    description={query
                                        ? `Nothing matches "${query.trim()}". Try a different name.`
                                        : 'Install or publish a plugin to see it listed here.'}
                                />
                            </Row>
                        ) : (
                            <Stack
                                id={resultsListId}
                                role='listbox'
                                aria-label='Plugin search results'
                                className='canvas-plugin-search-list'
                                gap='025'
                                p='05'
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
                                            className={`canvas-plugin-search-item d-flex items-center gap-05 p-05 radius-sm ${isActive ? 'canvas-plugin-search-item--active' : ''}`}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleSelect(index)}
                                        >
                                            <Text size='md' tone='secondary' truncate>{modifier.name}</Text>
                                        </button>
                                    );
                                })}
                            </Stack>
                        )}
                    </Surface>
                </FloatingPortal>
            )}
        </div>
    );
};

export default CanvasPluginSearch;
