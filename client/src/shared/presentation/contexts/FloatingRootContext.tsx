import { createContext, useContext } from 'react';

/**
 * Provides the portal root for @floating-ui/react's FloatingPortal.
 *
 * When a floating element (Select, Tooltip, Popover, etc.) lives inside a
 * native <dialog> opened with .showModal(), the dialog is in the browser's
 * "top layer" - above everything in the normal stacking context. FloatingPortal
 * defaults to document.body, which sits *below* the top layer, making the
 * dropdown invisible.
 *
 * The Modal component provides its <dialog> element via this context so that
 * every FloatingPortal renders *inside* the dialog instead.
 */
const FloatingRootContext = createContext<HTMLElement | undefined>(undefined);

export const useFloatingRoot = (): HTMLElement | undefined => {
    return useContext(FloatingRootContext);
};

export default FloatingRootContext;
