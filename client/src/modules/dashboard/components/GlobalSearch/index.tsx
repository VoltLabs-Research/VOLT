import { cn } from '@heroui/react';
import './GlobalSearch.css';
import { useFloatingRoot } from '@/shared/ui/contexts/FloatingRootContext';
import useDashboardGlobalSearch from '@/modules/dashboard/hooks/use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { Box, Breadcrumbs, Loader, SearchInput, EmptyState } from '@voltstack/bravais';
import type { BreadcrumbItem } from '@voltstack/bravais';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Box as CubeIcon, MessageCircle, Package, ScanSearch, Users, Workflow } from 'lucide-react';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/service';

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
    },
    {
        key: 'chats',
        icon: <MessageCircle />,
        title: 'Chats'
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

        const items: BreadcrumbItem[] = contextBreadcrumb.items.map((item) => ({
            id: item.id ?? 'root',
            title: item.title,
            onClick: () => contextBreadcrumb.onNavigate(item.id)
        }));

        return (
            <Breadcrumbs
                items={items}
                variant='pill'
                ariaLabel='Context breadcrumbs'
                className='global-search-breadcrumb text-sm'
            />
        );
    }, [contextBreadcrumb]);

    const renderItem = (item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;
        const isDisabled = item.disabled === true;
        const optionId = `${resultsListId}-option-${itemIndex}`;

        return (
            <div className={cn('flex flex-col items-start gap-1 rounded-lg w-full cursor-pointer', `global-search-item list-item-hoverable${isActive ? ' global-search-item--active' : ''}${isDisabled ? ' global-search-item--disabled' : ''}`)} key={item.id} id={optionId} role='option' aria-selected={isActive} aria-disabled={isDisabled} tabIndex={-1} onClick={() => handleSelect(item)} onMouseDown={(event) => event.preventDefault()} title={item.subtitle ? `${item.title} - ${item.subtitle}` : item.title} aria-label={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title}>
                <p className='text-sm font-medium truncate w-full' title={item.title}>{item.title}</p>
                {item.subtitle ? (
                    <p className='text-xs text-muted truncate w-full' title={item.subtitle}>{item.subtitle}</p>
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
            <div className='global-search-section' key={key} role='group' aria-labelledby={`${resultsListId}-${key}-label`}>
                <div className='flex flex-row items-center gap-2 p-3 global-search-section-header text-base text-muted' id={`${resultsListId}-${key}-label`}>
                    <span aria-hidden='true'>{icon}</span>
                    <p className='text-xs font-medium'>{title}</p>
                </div>
                <div className='flex flex-col gap-1 global-search-section-items'>
                    {items.map(renderItem)}
                </div>
            </div>
        );
    };

    return (
        <Box width='max' className='global-search-wrapper' ref={refs.setReference} {...getReferenceProps()}>
            <SearchInput
                id={searchInputId}
                placeholder='Search…'
                value={query}
                aria-label='Global search'
                role='combobox'
                aria-autocomplete='list'
                aria-expanded={showResults}
                aria-haspopup='listbox'
                aria-controls={showResults ? resultsListId : undefined}
                aria-activedescendant={activeOptionId}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                    setIsFocused(true);
                    setFocusTipTrigger((current) => current + 1);
                    handleFocus();
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                overlayContent={breadcrumbOverlay}
                overlayVisible={showContextBreadcrumb}
            />

            {showResults && (
                <FloatingPortal root={floatingRoot}>
                    <Box radius='md' overflow='y-auto' ref={refs.setFloating} className='global-search-results bg-surface border border-border panel-floating' aria-busy={isLoading} style={floatingStyles} {...getFloatingProps()}>
                        <p className='sr-only' role='status' aria-live='polite' aria-atomic='true'>
                            {isLoading ? 'Searching…' : totalResults === 0 ? 'No results found.' : `${totalResults} result${totalResults === 1 ? '' : 's'} available.`}
                        </p>

                        {isLoading && (
                            <div className='p-8 global-search-loading'>
                                <Loader scale={0.5} isFixed={false} announce />
                            </div>
                        )}

                        {!isLoading && totalResults === 0 && <EmptyState title='No results found' description='' announce />}

                        {!isLoading && totalResults > 0 && (
                            <div className='flex flex-col global-search-results-list' id={resultsListId} role='listbox' aria-label='Global search results'>
                                {SECTIONS.map(renderSection)}
                            </div>
                        )}
                    </Box>
                </FloatingPortal>
            )}
        </Box>
    );
};

export default GlobalSearch;
