import { Toaster } from 'sileo';
import { useEffect, useRef } from 'react';

const POPOVER_STYLE = {
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    overflow: 'visible'
} as const;

/*
 * No `theme` prop on purpose: sileo would stamp its own data-theme on the
 * viewport and re-resolve the app's CSS variables against it. Leaving it
 * unset lets toasts inherit the app theme straight from documentElement,
 * and every toast fills with the app's tertiary surface by default.
 */
const TOASTER_DEFAULTS = {
    fill: 'var(--surface-tertiary)'
};

const AppToaster = () => {
    const popoverRef = useRef<HTMLDivElement>(null);

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
            <Toaster
                position='bottom-right'
                options={TOASTER_DEFAULTS}
            />
        </div>
    );
};

export default AppToaster;
