import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/ensure-monaco';
import { Toaster } from 'sileo';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Renders Sileo's <Toaster /> at the application root.
 * We avoid portaling into modals because it causes the toast to visually
 * jump. Instead, we wrap the Toaster in a native popover element and
 * show it manually, which pushes it to the browser's top layer natively.
 */
const AppToaster = () => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    const popoverStyle = useMemo(() => {
        return {
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            overflow: 'visible'
        };
    }, []);

    useEffect(() => {
        const popoverElement = popoverRef.current;

        if (popoverElement) {
            try {
                popoverElement.showPopover();
            } catch (e) {
                // Ignore if browser doesn't support or already shown
            }
        }

        const unsubscribeTheme = subscribeToAppTheme(setTheme);

        return () => {
            unsubscribeTheme();
        };
    }, []);

    return (
        <div
            ref={popoverRef}
            popover='manual'
            style={popoverStyle}
            data-theme={theme}
            aria-live='polite'
            aria-relevant='additions text'
        >
            <Toaster
                position='bottom-right'
                theme={theme === Theme.Dark ? 'dark' : 'light'}
            />
        </div>
    );
};

export default AppToaster;
