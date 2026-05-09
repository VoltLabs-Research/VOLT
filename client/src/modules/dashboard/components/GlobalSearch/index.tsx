import './GlobalSearch.css';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import useDashboardGlobalSearch from '@/modules/dashboard/hooks/use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import Box from '@/shared/presentation/primitives/Box';
import Breadcrumbs from '@/shared/presentation/primitives/Breadcrumbs';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import SearchInput from '@/shared/presentation/primitives/SearchInput';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { useId, useMemo, useState } from 'react';
import type { BreadcrumbItem } from '@/shared/presentation/primitives/Breadcrumbs';
import type { ReactNode } from 'react';
import { Box as CubeIcon, ScanSearch } from 'lucide-react';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import { IoCubeOutline, IoPeopleOutline } from 'react-icons/io5';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/service';

type SectionConfig = {
    key: GlobalSearchSectionKey;
    icon: ReactNode;
    title: string;
};

const SECTIONS: SectionConfig[] = [
    {
        key: 'analyses',
        icon: <GoWorkflow />,
        title: 'Analyses'
    },
    {
        key: 'trajectories',
        icon: <ScanSearch size={16} />,
        title: 'Trajectories'
    },
    {
        key: 'containers',
        icon: <IoCubeOutline />,
        title: 'Containers'
    },
    {
        key: 'plugins',
        icon: <CubeIcon size={16} />,
        title: 'Plugins'
    },
    {
        key: 'teams',
        icon: <IoPeopleOutline />,
        title: 'Teams'
    },
    {
        key: 'chats',
        icon: <CiChat1 />,
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

    const flattenedEntries = useMemo(() => {
        return sections.flatMap((section) => section.items.map((item) => ({
            id: item.id,
            sectionKey: section.key
        })));
    }, [sections]);

    const activeEntry = activeIndex >= 0 ? flattenedEntries[activeIndex] : null;
    const activeOptionId = activeEntry
        ? `${resultsListId}-${activeEntry.sectionKey}-${activeEntry.id}`
        : undefined;

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
                className='global-search-breadcrumb font-size-2'
            />
        );
    }, [contextBreadcrumb]);

    const renderItem = (sectionKey: GlobalSearchSectionKey, item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;
        const optionId = `${resultsListId}-${sectionKey}-${item.id}`;

        return (
            <Stack align='start' gap='025' width='max' radius='sm' cursor='pointer' key={item.id} id={optionId} role='option' aria-selected={isActive} tabIndex={-1} onClick={() => handleSelect(item)} onMouseDown={(event) => event.preventDefault()} title={item.subtitle ? `${item.title} - ${item.subtitle}` : item.title} aria-label={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title} className={`global-search-item list-item-hoverable${isActive ? ' global-search-item--active' : ''}`}>
                <Text as='p' size='md' weight='medium' truncate className='w-max' title={item.title}>{item.title}</Text>
                {item.subtitle ? (
                    <Text as='p' size='sm' tone='muted' truncate className='w-max' title={item.subtitle}>{item.subtitle}</Text>
                ) : null}
            </Stack>
        );
    };

    const renderSection = ({ key, icon, title }: SectionConfig) => {
        const section = sections.find((entry) => entry.key === key);
        const items = section?.items ?? [];

        if (!items.length) {
            return null;
        }

        return (
            <Box key={key} className='global-search-section' role='group' aria-labelledby={`${resultsListId}-${key}-label`}>
                <Row gap='05' p='075' id={`${resultsListId}-${key}-label`} className='global-search-section-header font-size-3 color-muted'>
                    <span aria-hidden='true'>{icon}</span>
                    <Text as='p' size='sm' weight='medium'>{title}</Text>
                </Row>
                <Stack gap='025' className='global-search-section-items'>
                    {items.map((item) => renderItem(key, item))}
                </Stack>
            </Box>
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
                    <Box radius='md' overflow='y-auto' ref={refs.setFloating} className='global-search-results glass-bg panel-floating' aria-busy={isLoading} style={floatingStyles} {...getFloatingProps()}>
                        <Text as='p' className='sr-only' role='status' aria-live='polite' aria-atomic='true'>
                            {isLoading ? 'Searching…' : totalResults === 0 ? 'No results found.' : `${totalResults} result${totalResults === 1 ? '' : 's'} available.`}
                        </Text>

                        {isLoading && (
                            <Box p='2' className='global-search-loading'>
                                <Loader scale={0.5} isFixed={false} announce />
                            </Box>
                        )}

                        {!isLoading && totalResults === 0 && <EmptyState title='No results found' description='' announce />}

                        {!isLoading && totalResults > 0 && (
                            <Stack id={resultsListId} role='listbox' aria-label='Global search results' className='global-search-results-list'>
                                {SECTIONS.map(renderSection)}
                            </Stack>
                        )}
                    </Box>
                </FloatingPortal>
            )}
        </Box>
    );
};

export default GlobalSearch;
