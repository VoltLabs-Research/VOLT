import { useColorScheme } from '@/shared/ui/hooks/use-color-scheme';
import { Toaster } from 'sileo';
import { useEffect, useRef } from 'react';

const POPOVER_STYLE = {
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    overflow: 'visible'
} as const;

// Pollium's toasts: sileo's own opaque fill for the theme, inverted against the page, so they
// read without a blur behind them.
const AppToaster = () => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const colorScheme = useColorScheme();

    useEffect(() => {
        popoverRef.current?.showPopover();
    }, []);

    return (
        <div
            ref={popoverRef}
            id='app-toaster-popover'
            popover='manual'
            style={POPOVER_STYLE}
        >
            <Toaster position='bottom-right' theme={colorScheme} />
        </div>
    );
};

export default AppToaster;
