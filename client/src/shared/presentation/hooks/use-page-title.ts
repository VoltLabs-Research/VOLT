import { useEffect, useRef } from 'react';

interface PageTitleRegistration {
    priority: number;
    title: string;
};

const APP_NAME = 'VOLT';
const FALLBACK_PAGE_TITLE_PRIORITY = 0;
const PAGE_TITLE_PRIORITY = 1;

let nextRegistrationId = 0;
const pageTitleRegistrations = new Map<number, PageTitleRegistration>();

const formatPageTitle = (title: string): string => {
    return title ? `${title} - ${APP_NAME}` : APP_NAME;
};

const syncDocumentTitle = (): void => {
    const sortedRegistrations = Array.from(pageTitleRegistrations.entries()).sort((left, right) => {
        const [, leftRegistration] = left;
        const [, rightRegistration] = right;

        if (leftRegistration.priority !== rightRegistration.priority) {
            return leftRegistration.priority - rightRegistration.priority;
        }

        return left[0] - right[0];
    });

    const activeRegistration = sortedRegistrations.length > 0
        ? sortedRegistrations[sortedRegistrations.length - 1]?.[1]
        : undefined;
    document.title = formatPageTitle(activeRegistration?.title ?? '');
};

const useRegisteredPageTitle = (title: string, priority: number): void => {
    const registrationIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (registrationIdRef.current === null) {
            registrationIdRef.current = nextRegistrationId;
            nextRegistrationId += 1;
        }

        pageTitleRegistrations.set(registrationIdRef.current, {
            priority,
            title
        });
        syncDocumentTitle();

        return () => {
            if (registrationIdRef.current === null) {
                return;
            }

            pageTitleRegistrations.delete(registrationIdRef.current);
            syncDocumentTitle();
        };
    }, [priority, title]);
};

/** Sets a page title that overrides the route-level fallback while mounted. */
export function usePageTitle(title: string): void {
    useRegisteredPageTitle(title, PAGE_TITLE_PRIORITY);
};

/** Sets a route-level fallback title unless a page override is active. */
export function useFallbackPageTitle(title: string): void {
    useRegisteredPageTitle(title, FALLBACK_PAGE_TITLE_PRIORITY);
};
