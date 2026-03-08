import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useFloating,
    useDismiss,
    useInteractions,
    offset,
    flip,
    shift,
    size,
    autoUpdate
} from '@floating-ui/react';
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    type GlobalSearchOutputDTO,
    type GlobalSearchSectionKey
} from '@/modules/dashboard/api/dtos/global-search';
import { useGlobalSearchQuery } from '@/modules/dashboard/hooks/queries';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 5;

export interface DashboardGlobalSearchItem {
    id: string;
    title: string;
    subtitle: string;
    path: string;
}

export interface DashboardGlobalSearchSection {
    key: GlobalSearchSectionKey;
    items: DashboardGlobalSearchItem[];
}

const formatSearchDate = (value: string): string => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString();
};

const buildSections = (results: GlobalSearchOutputDTO): DashboardGlobalSearchSection[] => {
    return [
        {
            key: 'analyses',
            items: results.analyses.map((analysis) => ({
                id: analysis._id,
                title: analysis.pluginDisplayName || analysis.plugin,
                subtitle: formatSearchDate(analysis.createdAt),
                path: '/dashboard/analysis-configs'
            }))
        },
        {
            key: 'trajectories',
            items: results.trajectories.map((trajectory) => ({
                id: trajectory._id,
                title: trajectory.name,
                subtitle: trajectory.status || '',
                path: `/dashboard/trajectories/${trajectory._id}`
            }))
        },
        {
            key: 'containers',
            items: results.containers.map((container) => ({
                id: container._id,
                title: container.name,
                subtitle: container.image,
                path: '/dashboard/containers'
            }))
        },
        {
            key: 'plugins',
            items: results.plugins.map((plugin) => ({
                id: plugin._id,
                title: plugin.modifier?.name || plugin._id,
                subtitle: plugin.modifier?.description || '',
                path: `/dashboard/plugins/${plugin._id}`
            }))
        },
        {
            key: 'teams',
            items: results.teams.map((team) => ({
                id: team._id,
                title: team.name,
                subtitle: team.description || '',
                path: '/dashboard'
            }))
        },
        {
            key: 'chats',
            items: results.chats.map((chat) => ({
                id: chat._id,
                title: chat.participants
                    .map((participant) => participant.firstName || participant.email)
                    .join(', ') || 'Chat',
                subtitle: chat.lastMessage?.content?.substring(0, 50) || 'No messages',
                path: '/dashboard/messages'
            }))
        }
    ];
};

export const useDashboardGlobalSearch = () => {
    const navigate = useNavigate();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showResults, setShowResults] = useState(false);

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

        if (!nextQuery) {
            setDebouncedQuery('');
            setShowResults(false);
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
        { enabled: Boolean(debouncedQuery) }
    );

    const results = searchQuery.data ?? EMPTY_GLOBAL_SEARCH_RESULTS;
    const sections = useMemo(() => buildSections(results), [results]);
    const totalResults = useMemo(
        () => sections.reduce((count, section) => count + section.items.length, 0),
        [sections]
    );
    const isDebouncing = Boolean(query.trim()) && query.trim() !== debouncedQuery;
    const isLoading = isDebouncing || (Boolean(debouncedQuery) && searchQuery.isLoading);

    const resetSearch = () => {
        setQuery('');
        setDebouncedQuery('');
        setShowResults(false);
    };

    const handleSelect = (path: string) => {
        navigate(path);
        resetSearch();
    };

    const handleFocus = () => {
        if (query.trim()) {
            setShowResults(true);
        }
    };

    return {
        refs,
        floatingStyles,
        getReferenceProps,
        getFloatingProps,
        query,
        showResults,
        sections,
        totalResults,
        isLoading,
        setQuery,
        handleFocus,
        handleSelect
    };
};

export default useDashboardGlobalSearch;
