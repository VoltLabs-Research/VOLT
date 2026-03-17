import './GlobalSearch.css';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import useDashboardGlobalSearch from '@/modules/dashboard/hooks/use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SearchInput from '@/shared/presentation/components/SearchInput';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import { IoChevronForward, IoCubeOutline, IoPeopleOutline } from 'react-icons/io5';
import { TbCube3dSphere, TbObjectScan } from 'react-icons/tb';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/dtos/global-search';

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
        icon: <TbObjectScan />,
        title: 'Trajectories'
    },
    {
        key: 'containers',
        icon: <IoCubeOutline />,
        title: 'Containers'
    },
    {
        key: 'plugins',
        icon: <TbCube3dSphere />,
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
};

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

        return (
            <Container className='global-search-breadcrumb d-flex items-center gap-05 font-size-2'>
                {contextBreadcrumb.items.map((item, index) => {
                    const isCurrent = index === contextBreadcrumb.items.length - 1;

                    return (
                        <Container key={item.id ?? 'root'} className='d-flex items-center gap-05'>
                            {index > 0 && <IoChevronForward size={12} className='color-muted' aria-hidden='true' />}
                            <button
                                type='button'
                                className={`global-search-breadcrumb-item ${isCurrent ? 'is-current' : ''}`}
                                onClick={() => contextBreadcrumb.onNavigate(item.id)}
                            >
                                {item.title}
                            </button>
                        </Container>
                    );
                })}
            </Container>
        );
    }, [contextBreadcrumb]);

    const renderItem = (sectionKey: GlobalSearchSectionKey, item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;
        const optionId = `${resultsListId}-${sectionKey}-${item.id}`;

        return (
            <Container
                key={item.id}
                id={optionId}
                role='option'
                aria-selected={isActive}
                tabIndex={-1}
                onClick={() => handleSelect(item)}
                onMouseDown={(event) => event.preventDefault()}
                title={item.subtitle ? `${item.title} - ${item.subtitle}` : item.title}
                aria-label={item.subtitle ? `${item.title}. ${item.subtitle}` : item.title}
                className={`global-search-item list-item-hoverable radius-sm d-flex column items-start gap-025 w-max cursor-pointer${isActive ? ' global-search-item--active' : ''}`}
            >
                <Paragraph className='font-size-2 font-weight-5 text-truncate w-max' title={item.title}>{item.title}</Paragraph>
                {item.subtitle ? (
                    <Paragraph className='font-size-1 color-muted text-truncate w-max' title={item.subtitle}>{item.subtitle}</Paragraph>
                ) : null}
            </Container>
        );
    };

    const renderSection = ({ key, icon, title }: SectionConfig) => {
        const section = sections.find((entry) => entry.key === key);
        const items = section?.items ?? [];

        if (!items.length) {
            return null;
        }

        return (
            <Container key={key} className='global-search-section' role='group' aria-labelledby={`${resultsListId}-${key}-label`}>
                <Container id={`${resultsListId}-${key}-label`} className='global-search-section-header d-flex items-center gap-05 p-075 font-size-3 color-muted'>
                    <span aria-hidden='true'>{icon}</span>
                    <Paragraph className='font-size-1 font-weight-5'>{title}</Paragraph>
                </Container>
                <Container className='global-search-section-items d-flex column gap-025'>
                    {items.map((item) => renderItem(key, item))}
                </Container>
            </Container>
        );
    };

    return (
        <Container className='global-search-wrapper w-max' ref={refs.setReference} {...getReferenceProps()}>
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
                    <Container
                        ref={refs.setFloating}
                        className='global-search-results glass-bg panel-floating radius-md y-auto'
                        aria-busy={isLoading}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <Paragraph className='global-search-status' role='status' aria-live='polite' aria-atomic='true'>
                            {isLoading ? 'Searching…' : totalResults === 0 ? 'No results found.' : `${totalResults} result${totalResults === 1 ? '' : 's'} available.`}
                        </Paragraph>

                        {isLoading && (
                            <Container className='global-search-loading p-2'>
                                <Loader scale={0.5} isFixed={false} announce />
                            </Container>
                        )}

                        {!isLoading && totalResults === 0 && <EmptyState title='No results found' description='' announce />}

                        {!isLoading && totalResults > 0 && (
                            <Container
                                id={resultsListId}
                                role='listbox'
                                aria-label='Global search results'
                                className='global-search-results-list d-flex column'
                            >
                                {SECTIONS.map(renderSection)}
                            </Container>
                        )}
                    </Container>
                </FloatingPortal>
            )}
        </Container>
    );
};

export default GlobalSearch;
