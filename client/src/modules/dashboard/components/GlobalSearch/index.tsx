import Loader from '@/shared/ui/components/Loader';
import { EmptyStateRoot, SearchField, cn } from '@heroui/react';
import { useFloatingRoot } from '@/shared/ui/contexts/FloatingRootContext';
import useDashboardGlobalSearch from '@/modules/dashboard/hooks/use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box as CubeIcon, ChevronRight, Package, ScanSearch, Users, Workflow } from 'lucide-react';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/service';
import Scrollable from '@/shared/ui/components/Scrollable';

type SectionConfig = {
    key: GlobalSearchSectionKey;
    icon: ReactNode;
    title: string;
};

const SECTIONS: SectionConfig[] = [
    {
        key: 'analyses',
        icon: <Workflow />,
        title: 'Analyses'
    },
    {
        key: 'trajectories',
        icon: <ScanSearch size={16} />,
        title: 'Trajectories'
    },
    {
        key: 'containers',
        icon: <Package />,
        title: 'Containers'
    },
    {
        key: 'plugins',
        icon: <CubeIcon size={16} />,
        title: 'Plugins'
    },
    {
        key: 'teams',
        icon: <Users />,
        title: 'Teams'
    }
];

interface GlobalSearchProps {
    contextBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
}

const GlobalSearch = ({ contextBreadcrumb = null }: GlobalSearchProps) => {
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

    const breadcrumbOverlay = useMemo(() => {
        if (!contextBreadcrumb?.items.length) {
            return null;
        }

        const items = contextBreadcrumb.items;

        return (
            <nav className='pointer-events-none text-sm' aria-label='Context breadcrumbs'>
                <ol className='m-0 flex min-w-0 list-none flex-wrap items-center gap-1 p-0'>
                    {items.map((item, index) => {
                        const isLast = index === items.length - 1;

                        return (
                            <li className='flex min-w-0 items-center gap-1' key={item.id ?? 'root'}>
                                {index > 0 && <ChevronRight size={12} className='shrink-0 text-muted' aria-hidden='true' />}
                                {isLast ? (
                                    <span className='inline-flex min-w-0 max-w-[12rem] items-center gap-1 truncate rounded-lg px-2 py-1.5 font-medium text-muted' aria-current='page' title={item.title}>
                                        {item.title}
                                    </span>
                                ) : (
                                    <button
                                        type='button'
                                        className={cn('inline-flex min-w-0 max-w-[12rem] items-center gap-1 truncate rounded-lg px-2 py-1.5 font-medium text-muted', 'pointer-events-auto cursor-pointer border-none bg-transparent transition-[background-color,color,box-shadow] duration-150 ease-[ease] hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover focus-visible:text-foreground focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_3px_var(--focus)] active:bg-surface-hover')}
                                        title={item.title}
                                        aria-label={`Open ${item.title}`}
                                        onClick={() => contextBreadcrumb.onNavigate(item.id)}
                                    >
                                        {item.title}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        );
    }, [contextBreadcrumb]);

    const renderItem = (item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;
        const isDisabled = item.disabled === true;
        const optionId = `${resultsListId}-option-${itemIndex}`;

        return (
            <div className={cn('flex w-full min-w-0 cursor-pointer flex-col items-start gap-1 rounded-lg p-3 shadow-[inset_0_0_0_1px_transparent] transition-[background-color,box-shadow] duration-200 ease-[ease] hover:bg-surface-tertiary focus-visible:outline-none focus-visible:bg-surface-tertiary focus-visible:shadow-[0_0_0_2px_var(--focus)] active:bg-surface-hover', isActive && 'bg-surface-tertiary shadow-[inset_0_0_0_1px_var(--border)]', isDisabled && 'opacity-45 cursor-not-allowed pointer-events-none')} key={item.id} id={optionId} role='option' aria-selected={isActive} aria-disabled={isDisabled} tabIndex={-1} onClick={() => handleSelect(item)} onMouseDown={(event) => event.preventDefault()} title={item.subtitle ? `${item.title} - ${item.subtitle}` : item.title} aria-label={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title}>
                <p className='m-0 text-sm font-medium truncate w-full' title={item.title}>{item.title}</p>
                {item.subtitle ? (
                    <p className='m-0 text-xs text-muted truncate w-full' title={item.subtitle}>{item.subtitle}</p>
                ) : null}
            </div>
        );
    };

    const renderSection = ({ key, icon, title }: SectionConfig) => {
        const section = sections.find((entry) => entry.key === key);
        const items = section?.items ?? [];

        if (!items.length) {
            return null;
        }

        return (
            <div className='py-1 border-b border-border last:border-b-0' key={key} role='group' aria-labelledby={`${resultsListId}-${key}-label`}>
                <div className='flex flex-row items-center gap-2 p-3 pb-2 text-base text-muted' id={`${resultsListId}-${key}-label`}>
                    <span aria-hidden='true'>{icon}</span>
                    <p className='text-xs font-medium'>{title}</p>
                </div>
                <div className='flex flex-col gap-1 px-2'>
                    {items.map(renderItem)}
                </div>
            </div>
        );
    };

    return (
        <div className='w-[min(100%,400px)] min-w-0 max-[768px]:w-full' ref={refs.setReference} {...getReferenceProps()}>
            <SearchField
                fullWidth
                value={query}
                onChange={setQuery}
                aria-label='Global search'
                onFocus={() => {
                    setIsFocused(true);
                    setFocusTipTrigger((current) => current + 1);
                    handleFocus();
                }}
                onBlur={() => setIsFocused(false)}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon className='shrink-0 text-muted' />
                    <div className='relative min-w-0 flex-1'>
                        {showContextBreadcrumb && breadcrumbOverlay && (
                            <div className='pointer-events-none absolute inset-0 z-[2] flex items-center overflow-hidden whitespace-nowrap'>
                                {breadcrumbOverlay}
                            </div>
                        )}

                        <SearchField.Input
                            id={searchInputId}
                            className={cn('relative z-[1]', showContextBreadcrumb && 'text-transparent caret-[var(--foreground)]')}
                            placeholder={showContextBreadcrumb ? '' : 'Search…'}
                            role='combobox'
                            aria-autocomplete='list'
                            aria-expanded={showResults}
                            aria-haspopup='listbox'
                            aria-controls={showResults ? resultsListId : undefined}
                            aria-activedescendant={activeOptionId}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </SearchField.Group>
            </SearchField>

            {showResults && (
                <FloatingPortal root={floatingRoot}>
                    <Scrollable ref={refs.setFloating} className='w-[min(32rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] max-h-[60vh] rounded-xl border border-border bg-surface shadow-overlay z-[var(--z-floating)] max-[768px]:max-h-[min(60vh,28rem)]' aria-busy={isLoading} style={floatingStyles} {...getFloatingProps()}>
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
                            <div className='flex flex-col py-1' id={resultsListId} role='listbox' aria-label='Global search results'>
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
