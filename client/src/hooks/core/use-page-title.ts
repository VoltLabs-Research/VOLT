import { useEffect } from 'react';

const APP_NAME = 'Volt';

export function usePageTitle(title: string): void {
    useEffect(() => {
        document.title = title ? `${title} - ${APP_NAME}` : APP_NAME;
    }, [title]);
}
