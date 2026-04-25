import { useGlobalSearchQuery } from '@/modules/dashboard/hooks/queries';
import { EMPTY_GLOBAL_SEARCH_RESULTS } from '@/modules/dashboard/api/dtos/global-search';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import {
    autoUpdate,
    flip,
    offset,
    shift,
    size,
    useDismiss,
    useFloating,
    useInteractions
} from '@floating-ui/react';
import { format, isValid } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalSearchOutputDTO, GlobalSearchSectionKey } from '@/modules/dashboard/api/dtos/global-search';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_RESULT_LIMIT = 5;
const MIN_SEARCH_QUERY_LENGTH = 2;

export interface DashboardGlobalSearchItem {
    id: string;
    title: string;
    subtitle: string;
    path: string;
    teamId?: string;
};

export interface DashboardGlobalSearchSection {
    key: GlobalSearchSectionKey;
    items: DashboardGlobalSearchItem[];
};

const ensureArray = <T>(value: T[] | undefined | null): T[] => {
    if (Array.isArray(value)) {
        return value;
    }

    return [];
};

const formatSearchDate = (value: string): string => {
    const date = new Date(value);

    if (!isValid(date)) {
        return '';
    }

    return format(date, 'P');
};

const buildSections = (results: GlobalSearchOutputDTO): DashboardGlobalSearchSection[] => {
    const analyses = ensureArray(results.analyses);
    const trajectories = ensureArray(results.trajectories);
    const containers = ensureArray(results.containers);
    const plugins = ensureArray(results.plugins);
    const teams = ensureArray(results.teams);
    const chats = ensureArray(results.chats);

    return [
        {
            key: 'analyses',
            items: analyses.map((analysis) => ({
                id: analysis._id,
                title: analysis.pluginDisplayName,
                subtitle: formatSearchDate(analysis.createdAt),
                path: `/canvas/${analysis.trajectory._id}?analysis=${analysis._id}`
            }))
        },
        {
            key: 'trajectories',
            items: trajectories.map((trajectory) => ({
                id: trajectory._id,
                title: trajectory.name,
                subtitle: trajectory.status || '',
                path: `/canvas/${trajectory._id}`
            }))
        },
        {
            key: 'containers',
            items: containers.map((container) => ({
                id: container._id,
                title: container.name,
                subtitle: container.image,
                path: `/dashboard/containers/${container._id}`
            }))
        },
        {
            key: 'plugins',
            items: plugins.map((plugin) => {
                const listingExposure = plugin.listingExposures?.exposures[0] ?? getListingRelevantExposures(plugin.exposures)[0];

                return {
                    id: plugin._id,
                    title: plugin.modifier?.name || plugin._id,
                    subtitle: plugin.modifier?.description || '',
                    path: listingExposure
                        ? `/dashboard/plugins/${plugin._id}/exposure/${listingExposure.exposureId}/listing`
                        : '/dashboard/plugins/list'
                };
            })
        },
        {
            key: 'teams',
            items: teams.map((team) => ({
                id: team._id,
                title: team.name,
                subtitle: team.description || '',
                path: '/dashboard/my-team',
                teamId: team._id
            }))
        },
        {
            key: 'chats',
            items: chats.map((chat) => ({
                id: chat._id,
                title: chat.participants
                    .map((participant) => participant.firstName || participant.email)
                    .join(', ') || 'Chat',
                subtitle: chat.lastMessage?.content?.substring(0, 50) || 'No messages',
                path: `/dashboard/messages/${chat._id}`
            }))
        }
    ];
};

const useDashboardGlobalSearch = () => {
    const navigate = useNavigate();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const { refs, floatingStyles, context } = useFloating({
        open: showResults,
        onOpenChange: setShowResults,
        placement: 'bottom-start',
        middleware: [
            offset(8),
            flip({ padding: 8 }),
            shift({ padding: 8 }),
            size({
                apply({ rects, elements }) {
                    Object.assign(elements.floating.style, {
                        width: `${rects.reference.width}px`
                    });
                },
                padding: 8
            })
        ],
        whileElementsMounted: autoUpdate
    });

    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

    useEffect(() => {
        const nextQuery = query.trim();

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (nextQuery.length < MIN_SEARCH_QUERY_LENGTH) {
            setDebouncedQuery('');
            setShowResults(false);
            setActiveIndex(-1);
            return;
        }

        setShowResults(true);
        debounceRef.current = setTimeout(() => {
            setDebouncedQuery(nextQuery);
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const searchQuery = useGlobalSearchQuery(
        { query: debouncedQuery, limit: SEARCH_RESULT_LIMIT },
        { enabled: debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH }
    );

    const results = searchQuery.data ?? EMPTY_GLOBAL_SEARCH_RESULTS;
    const sections = useMemo(() => buildSections(results), [results]);
    const flattenedItems = useMemo<DashboardGlobalSearchItem[]>(() => {
        return sections.flatMap((section) => section.items);
    }, [sections]);
    const totalResults = useMemo(
        () => sections.reduce((count, section) => count + section.items.length, 0),
        [sections]
    );
    const isDebouncing = query.trim().length >= MIN_SEARCH_QUERY_LENGTH && query.trim() !== debouncedQuery;
    const isLoading = isDebouncing || (debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH && searchQuery.isLoading);

    const resetSearch = () => {
        setQuery('');
        setDebouncedQuery('');
        setShowResults(false);
        setActiveIndex(-1);
    };

    const handleSelect = (item: DashboardGlobalSearchItem) => {
        if (item.teamId) {
            setSelectedTeamId(item.teamId);
        }

        navigate(item.path);
        resetSearch();
    };

    const handleFocus = () => {
        if (query.trim().length >= MIN_SEARCH_QUERY_LENGTH) {
            setShowResults(true);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!showResults && event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Escape') {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!flattenedItems.length) {
                return;
            }

            if (!showResults) {
                setShowResults(true);
            }

            setActiveIndex((currentIndex) => {
                return currentIndex >= flattenedItems.length - 1 ? 0 : currentIndex + 1;
            });
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!flattenedItems.length) {
                return;
            }

            if (!showResults) {
                setShowResults(true);
            }

            setActiveIndex((currentIndex) => {
                if (currentIndex <= 0) {
                    return flattenedItems.length - 1;
                }

                return currentIndex - 1;
            });
            return;
        }

        if (event.key === 'Enter') {
            if (activeIndex < 0 || activeIndex >= flattenedItems.length) {
                return;
            }

            event.preventDefault();
            handleSelect(flattenedItems[activeIndex]);
            return;
        }

        if (event.key === 'Escape') {
            setShowResults(false);
            setActiveIndex(-1);
        }
    };

    useEffect(() => {
        if (!showResults || !flattenedItems.length) {
            setActiveIndex(-1);
            return;
        }

        setActiveIndex((currentIndex) => {
            if (currentIndex >= flattenedItems.length) {
                return flattenedItems.length - 1;
            }

            return currentIndex;
        });
    }, [flattenedItems, showResults]);

    return {
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
    };
};

export default useDashboardGlobalSearch;
