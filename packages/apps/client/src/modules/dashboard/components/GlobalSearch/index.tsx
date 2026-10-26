import Loader from '@/shared/ui/components/Loader';
import { BreadcrumbsItem, BreadcrumbsRoot, EmptyStateRoot, SearchField, cn } from '@heroui/react';
import { useFloatingRoot } from '@/shared/ui/contexts/FloatingRootContext';
import useDashboardGlobalSearch from './use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/service';
import Scrollable from '@/shared/ui/components/Scrollable';

type SectionConfig = {
    key: GlobalSearchSectionKey;
    title: string;
};

const SECTIONS: SectionConfig[] = [
    {
        key: 'analyses',
        title: 'Analyses'
    },
    {
        key: 'trajectories',
        title: 'Trajectories'
    },
    {
        key: 'plugins',
        title: 'Plugins'
    },
    {
        key: 'teams',
        title: 'Teams'
    }
];

const isEditableTarget = (target: EventTarget | null): boolean => (
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
);

interface GlobalSearchProps {
    contextBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
    // Focuses the field whenever it turns true.
    autoFocus?: boolean;
    // The field is leaving: it lost focus or the reader pressed Escape.
    onDismiss?: () => void;
}

// A press anywhere in the results keeps the field focused: its blur closes the phone overlay.
const keepInputFocus = (event: MouseEvent) => event.preventDefault();

const GlobalSearch = ({ contextBreadcrumb = null, autoFocus = false, onDismiss }: GlobalSearchProps) => {
    const {
        refs,
        floatingStyles,
        getReferenceProps,
        getFloatingProps,
        query,
        showResults,
        sections,
        activeIndex,
        totalResults,
        isLoading,
        setQuery,
        handleFocus,
        handleKeyDown,
        handleSelect
    } = useDashboardGlobalSearch();
    const floatingRoot = useFloatingRoot();
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [focusTipTrigger, setFocusTipTrigger] = useState(0);
    const searchInputId = useId();
    const resultsListId = useId();
    const emptyHeadingId = useId();
    let itemIndex = -1;

    const activeOptionId = activeIndex >= 0 ? `${resultsListId}-option-${activeIndex}` : undefined;

    useTip('dashboard-global-search', {
        enabled: isFocused && focusTipTrigger > 0,
        triggerKey: focusTipTrigger
    });

    const showContextBreadcrumb = !isFocused && query.length === 0 && !!contextBreadcrumb?.items.length;

    // ⌘K / Ctrl K focuses the field, unless the reader is typing somewhere else (an editor's own chords).
    useEffect(() => {
        const handleShortcut = (event: globalThis.KeyboardEvent) => {
            const input = inputRef.current;
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
            if (!input || input.offsetParent === null || isEditableTarget(event.target)) return;

            event.preventDefault();
            input.focus();
            input.select();
        };

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    // The field can be on the page already, hidden, when it is asked for; autoFocus would miss that.
    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        handleKeyDown(event);

        if (event.key === 'Escape') {
            onDismiss?.();
        }
    };

    const breadcrumbOverlay = useMemo(() => {
        if (!contextBreadcrumb?.items.length) {
            return null;
        }

        const items = contextBreadcrumb.items;

        return (
            <BreadcrumbsRoot className='pointer-events-none min-w-0 flex-wrap' aria-label='Context breadcrumbs'>
                {items.map((item) => (
                    <BreadcrumbsItem
                        key={item.id ?? 'root'}
                        className='pointer-events-auto'
                        onPress={() => contextBreadcrumb.onNavigate(item.id)}
                    >
                        <span className='block max-w-48 truncate'>{item.title}</span>
                    </BreadcrumbsItem>
                ))}
            </BreadcrumbsRoot>
        );
    }, [contextBreadcrumb]);

    const renderItem = (item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;
        const isDisabled = item.disabled === true;
        const optionId = `${resultsListId}-option-${itemIndex}`;

        return (
            <div className={cn('glass-panel-item min-w-0 cursor-pointer flex-col items-start gap-0 hover:bg-foreground/[0.06]', isDisabled && 'opacity-40 cursor-not-allowed pointer-events-none')} key={item.id} id={optionId} role='option' aria-selected={isActive} aria-disabled={isDisabled} tabIndex={-1} onClick={() => handleSelect(item)} title={item.subtitle ? `${item.title} - ${item.subtitle}` : item.title} aria-label={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title}>
                <p className='m-0 w-full truncate' title={item.title}>{item.title}</p>
                {item.subtitle ? (
                    <p className='m-0 w-full truncate text-xs leading-snug text-muted' title={item.subtitle}>{item.subtitle}</p>
                ) : null}
            </div>
        );
    };

    const renderSection = ({ key, title }: SectionConfig) => {
        const section = sections.find((entry) => entry.key === key);
        const items = section?.items ?? [];

        if (!items.length) {
            return null;
        }

        return (
            <div className='py-1 border-b border-foreground/[0.06] last:border-b-0' key={key} role='group' aria-labelledby={`${resultsListId}-${key}-label`}>
                <p className='px-2.5 pt-1.5 pb-1 text-xs text-muted' id={`${resultsListId}-${key}-label`}>{title}</p>
                <div className='flex flex-col gap-0.5'>
                    {items.map(renderItem)}
                </div>
            </div>
        );
    };

    return (
        <div className='w-full max-w-100 min-w-0' ref={refs.setReference} {...getReferenceProps()}>
            <SearchField
                fullWidth
                variant='secondary'
                value={query}
                onChange={setQuery}
                aria-label='Global search'
                onFocus={() => {
                    setIsFocused(true);
                    setFocusTipTrigger((current) => current + 1);
                    handleFocus();
                }}
                onBlur={() => {
                    setIsFocused(false);
                    onDismiss?.();
                }}
            >
                <SearchField.Group className='rounded-full border-0 bg-foreground/5 pe-1.5 hover:bg-foreground/8 focus-within:bg-foreground/8'>
                    <SearchField.SearchIcon className='shrink-0 text-muted' />
                    <div className='relative min-w-0 flex-1'>
                        {showContextBreadcrumb && breadcrumbOverlay && (
                            <div className='pointer-events-none absolute inset-0 z-[2] flex items-center overflow-hidden ps-2 whitespace-nowrap'>
                                {breadcrumbOverlay}
                            </div>
                        )}

                        <SearchField.Input
                            ref={inputRef}
                            id={searchInputId}
                            className={cn('relative z-[1]', showContextBreadcrumb && 'text-transparent caret-[var(--foreground)]')}
                            placeholder={showContextBreadcrumb ? '' : 'Search…'}
                            role='combobox'
                            aria-autocomplete='list'
                            aria-expanded={showResults}
                            aria-haspopup='listbox'
                            aria-controls={showResults ? resultsListId : undefined}
                            aria-activedescendant={activeOptionId}
                            onKeyDown={handleInputKeyDown}
                        />
                    </div>
                </SearchField.Group>
            </SearchField>

            {showResults && (
                <FloatingPortal root={floatingRoot}>
                    <Scrollable ref={refs.setFloating} className='w-[min(32rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] max-h-[60vh] glass-panel z-[var(--z-floating)] max-[768px]:max-h-[min(60vh,28rem)]' aria-busy={isLoading} style={floatingStyles} {...getFloatingProps({ onMouseDown: keepInputFocus })}>
                        <p className='sr-only' role='status' aria-live='polite' aria-atomic='true'>
                            {isLoading ? 'Searching…' : totalResults === 0 ? 'No results found.' : `${totalResults} result${totalResults === 1 ? '' : 's'} available.`}
                        </p>

                        {isLoading && (
                            <div className='flex items-center justify-center p-8'>
                                <Loader size='md' aria-label='Loading' />
                            </div>
                        )}

                        {!isLoading && totalResults === 0 && (
                            <EmptyStateRoot<'section'>
                                render={(props) => <section {...props} />}
                                aria-labelledby={emptyHeadingId}
                                className='flex h-[200px] flex-col items-center justify-center'
                            >
                                <div className='flex max-w-[320px] flex-col items-center gap-6 text-center'>
                                    <h2 id={emptyHeadingId} className='text-base font-medium text-foreground'>
                                        No results found
                                    </h2>
                                </div>
                            </EmptyStateRoot>
                        )}

                        {!isLoading && totalResults > 0 && (
                            <div className='flex flex-col' id={resultsListId} role='listbox' aria-label='Global search results'>
                                {SECTIONS.map(renderSection)}
                            </div>
                        )}
                    </Scrollable>
                </FloatingPortal>
            )}
        </div>
    );
};

export default GlobalSearch;
