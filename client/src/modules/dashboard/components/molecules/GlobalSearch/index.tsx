import './GlobalSearch.css';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import useDashboardGlobalSearch from '@/modules/dashboard/hooks/use-dashboard-global-search';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SearchInput from '@/shared/presentation/components/SearchInput';
import useTip from '@/shared/tips/use-tip';
import { FloatingPortal } from '@floating-ui/react';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import { IoChevronForward, IoCubeOutline, IoPeopleOutline } from 'react-icons/io5';
import { TbCube3dSphere, TbObjectScan } from 'react-icons/tb';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/dtos/global-search';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
    let itemIndex = -1;

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
                            {index > 0 && <IoChevronForward size={12} className='color-muted' />}
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

    const renderItem = (item: (typeof sections)[number]['items'][number]) => {
        itemIndex += 1;
        const isActive = itemIndex === activeIndex;

        return (
            <Button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`global-search-item d-flex column items-start gap-025 p-075 w-max cursor-pointer${isActive ? ' global-search-item--active' : ''}`}
                variant='ghost'
                intent='neutral'
                align='start'
            >
                <Paragraph className='font-size-2 font-weight-5'>{item.title}</Paragraph>
                <Paragraph className='font-size-1 color-muted'>{item.subtitle}</Paragraph>
            </Button>
        );
    };

    const renderSection = ({ key, icon, title }: SectionConfig) => {
        const section = sections.find((entry) => entry.key === key);
        const items = section?.items ?? [];

        if (!items.length) {
            return null;
        }

        return (
            <Container key={key} className='global-search-section'>
                <Container className='global-search-section-header d-flex items-center gap-05 p-075 font-size-3 color-muted'>
                    {icon}
                    <Paragraph className='font-size-1 font-weight-5'>{title}</Paragraph>
                </Container>
                {items.map(renderItem)}
            </Container>
        );
    };

    return (
        <Container className='global-search-wrapper w-max' ref={refs.setReference} {...getReferenceProps()}>
            <SearchInput
                placeholder='Search...'
                value={query}
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
                        className='global-search-results panel-floating radius-md y-auto'
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        {isLoading && <Container className='global-search-loading p-2'><EmptyState title='Searching...' description='' /></Container>}

                        {!isLoading && totalResults === 0 && <EmptyState title='No results found' description='' />}

                        {!isLoading && totalResults > 0 && SECTIONS.map(renderSection)}
                    </Container>
                </FloatingPortal>
            )}
        </Container>
    );
};

export default GlobalSearch;
