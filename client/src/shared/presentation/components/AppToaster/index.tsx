import { Toaster } from 'sileo';
import { useEffect, useRef } from 'react';

/**
 * Renders Sileo's <Toaster /> at the application root.
 * We avoid portaling into modals because it causes the toast to visually
 * jump. Instead, we wrap the Toaster in a native popover element and
 * show it manually, which pushes it to the browser's top layer natively.
 */
const AppToaster = () => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (popoverRef.current) {
            try {
                popoverRef.current.showPopover();
            } catch (e) {
                // Ignore if browser doesn't support or already shown
            }
        }
    }, []);

    return (
        <div ref={popoverRef} popover='manual' style={{ padding: 0, margin: 0, border: 'none', background: 'transparent', overflow: 'visible' }}>
            <Toaster
                position='bottom-right'
                theme='light'
                options={{ fill: '#171717' }}
            />
        </div>
    );
};

export default AppToaster;
