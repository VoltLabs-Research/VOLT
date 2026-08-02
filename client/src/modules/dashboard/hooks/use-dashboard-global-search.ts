import { useGlobalSearchQuery } from '@/modules/dashboard/hooks/queries';
import { EMPTY_GLOBAL_SEARCH_RESULTS, MIN_SEARCH_QUERY_LENGTH } from '@/modules/dashboard/api/service';
import useGlobalSearchKeyboardNavigation from '@/modules/dashboard/hooks/use-global-search-keyboard-navigation';
import { buildGlobalSearchSections } from '@/modules/dashboard/utils/global-search-sections';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardGlobalSearchItem } from '@/modules/dashboard/utils/global-search-sections';
import { useNavigate } from 'react-router-dom';
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_RESULT_LIMIT = 5;

const useDashboardGlobalSearch = () => {
    const navigate = useNavigate();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
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

    const searchQuery = useGlobalSearchQuery(
        {
            query: debouncedQuery,
            limit: SEARCH_RESULT_LIMIT
        },
        { enabled: debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH }
    );

    const sections = useMemo(
        () => buildGlobalSearchSections(searchQuery.data ?? EMPTY_GLOBAL_SEARCH_RESULTS),
        [searchQuery.data]
    );
    const flattenedItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);

    const handleSelect = (item: DashboardGlobalSearchItem) => {
        if (item.disabled) {
            return;
        }

        if (item.teamId) {
            setSelectedTeamId(item.teamId);
        }

        navigate(item.path);
        setQuery('');
        setDebouncedQuery('');
        setShowResults(false);
    };

    const { activeIndex, handleKeyDown } = useGlobalSearchKeyboardNavigation({
        items: flattenedItems,
        showResults,
        setShowResults,
        onSelect: handleSelect
    });

    useEffect(() => {
        const nextQuery = query.trim();

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (nextQuery.length < MIN_SEARCH_QUERY_LENGTH) {
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

    const isDebouncing = query.trim().length >= MIN_SEARCH_QUERY_LENGTH && query.trim() !== debouncedQuery;

    const handleFocus = () => {
        if (query.trim().length >= MIN_SEARCH_QUERY_LENGTH) {
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
        activeIndex,
        totalResults: flattenedItems.length,
        isLoading: isDebouncing || (debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH && searchQuery.isLoading),
        setQuery,
        handleFocus,
        handleKeyDown,
        handleSelect
    };
};

export default useDashboardGlobalSearch;
