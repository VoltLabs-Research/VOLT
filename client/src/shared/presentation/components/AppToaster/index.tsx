import { getActiveDialog, subscribeToActiveDialog } from '@/shared/presentation/utilities/active-dialog-store';
import { Toaster } from 'sileo';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders Sileo's <Toaster /> through a React portal targeting:
 * - The currently active native <dialog> when a modal is open, so toasts
 *   are promoted into the browser's top layer and remain visible above the
 *   modal backdrop.
 * - document.body when no modal is active.
 */
const AppToaster = () => {
    const [container, setContainer] = useState<Element>(
        () => getActiveDialog() ?? document.body
    );

    useEffect(() => {
        return subscribeToActiveDialog((dialog) => {
            setContainer(dialog ?? document.body);
        });
    }, []);

    return createPortal(
        <Toaster
            position='bottom-right'
            theme='light'
            options={{ fill: '#171717' }}
        />,
        container
    );
};

export default AppToaster;
