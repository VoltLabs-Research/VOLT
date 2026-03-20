import { useEffect, useRef } from 'react';

interface TitleEntry {
    id: number;
    title: string;
};

const APP_NAME = 'VOLT';

let nextTitleId = 0;
const fallbackTitles: TitleEntry[] = [];
const pageTitles: TitleEntry[] = [];

const formatPageTitle = (title: string): string => {
    return title ? `${title} - ${APP_NAME}` : APP_NAME;
};

const syncDocumentTitle = (): void => {
    const activeTitle = pageTitles.length > 0
        ? pageTitles[pageTitles.length - 1]?.title
        : fallbackTitles[fallbackTitles.length - 1]?.title;

    document.title = formatPageTitle(activeTitle ?? '');
};

const removeTitle = (titles: TitleEntry[], id: number): void => {
    const index = titles.findIndex((entry) => entry.id === id);
    if (index >= 0) {
        titles.splice(index, 1);
    }
};

const updateTitle = (titles: TitleEntry[], id: number, title: string): void => {
    const existingEntry = titles.find((entry) => entry.id === id);

    if (existingEntry) {
        existingEntry.title = title;
    } else {
        titles.push({ id, title });
    }

    syncDocumentTitle();
};

const useTrackedTitle = (title: string, titles: TitleEntry[]): void => {
    const titleIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (titleIdRef.current === null) {
            titleIdRef.current = nextTitleId;
            nextTitleId += 1;
        }

        return () => {
            if (titleIdRef.current === null) {
                return;
            }

            removeTitle(titles, titleIdRef.current);
            syncDocumentTitle();
        };
    }, [titles]);

    useEffect(() => {
        if (titleIdRef.current === null) {
            return;
        }

        updateTitle(titles, titleIdRef.current, title);
    }, [title, titles]);
};

/** Sets a page title that overrides the route-level fallback while mounted. */
export function usePageTitle(title: string): void {
    useTrackedTitle(title, pageTitles);
};

/** Sets a route-level fallback title unless a page override is active. */
export function useFallbackPageTitle(title: string): void {
    useTrackedTitle(title, fallbackTitles);
};
