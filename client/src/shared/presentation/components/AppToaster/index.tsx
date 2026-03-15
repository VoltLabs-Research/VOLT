import { Theme } from '@/shared/presentation/hooks/use-theme';
import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/presentation/utilities/ensure-monaco';
import { Toaster } from 'sileo';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders Sileo's <Toaster /> at the application root.
 * We avoid portaling into modals because it causes the toast to visually
 * jump. Instead, we wrap the Toaster in a native popover element and
 * show it manually, which pushes it to the browser's top layer natively.
 */

const POPOVER_STYLE = {
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    overflow: 'visible'
} as const;

const AppToaster = () => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<Theme>(() => getActiveAppTheme());

    useEffect(() => {
        const popoverElement = popoverRef.current;

        if (popoverElement) {
            popoverElement.showPopover();
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
            style={POPOVER_STYLE}
        >
            {/*
             * Sileo v0.1.5 uses contrast-inverted fills internally
             * (THEME_FILLS maps 'light' → dark fill, 'dark' → light fill).
             * We counter-invert the prop so notifications visually match
             * the app's active theme.
             */}
            <Toaster
                position='bottom-right'
                theme={theme === Theme.Dark ? 'light' : 'dark'}
            />
        </div>
    );
};

export default AppToaster;
