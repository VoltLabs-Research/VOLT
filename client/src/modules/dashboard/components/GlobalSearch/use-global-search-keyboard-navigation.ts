import { useEffect, useState } from 'react';
import type { DashboardGlobalSearchItem } from '@/modules/dashboard/utils/global-search-sections';
import type { KeyboardEvent } from 'react';

interface UseGlobalSearchKeyboardNavigationOptions {
    items: DashboardGlobalSearchItem[];
    showResults: boolean;
    setShowResults: (showResults: boolean) => void;
    onSelect: (item: DashboardGlobalSearchItem) => void;
}

const useGlobalSearchKeyboardNavigation = ({
    items,
    showResults,
    setShowResults,
    onSelect
}: UseGlobalSearchKeyboardNavigationOptions) => {
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        if (!showResults || !items.length) {
            setActiveIndex(-1);
            return;
        }

        setActiveIndex((currentIndex) => {
            if (currentIndex >= items.length) {
                return items.length - 1;
            }

            return currentIndex;
        });
    }, [items, showResults]);

    const moveActiveIndex = (event: KeyboardEvent<HTMLInputElement>, step: 1 | -1) => {
        event.preventDefault();

        if (!items.length) {
            return;
        }

        if (!showResults) {
            setShowResults(true);
        }

        setActiveIndex((currentIndex) => {
            if (step === 1) {
                return currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
            }

            return currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            moveActiveIndex(event, 1);
            return;
        }

        if (event.key === 'ArrowUp') {
            moveActiveIndex(event, -1);
            return;
        }

        if (event.key === 'Escape') {
            setShowResults(false);
            return;
        }

        if (event.key === 'Enter' && showResults && activeIndex >= 0 && activeIndex < items.length) {
            event.preventDefault();
            onSelect(items[activeIndex]);
        }
    };

    return {
        activeIndex,
        handleKeyDown
    };
};

export default useGlobalSearchKeyboardNavigation;
