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
export const TopLayerRootContext = createContext<HTMLElement | undefined>(undefined);
export const FloatingOwnerIdsContext = createContext<string[]>([]);
export const FLOATING_OWNER_IDS_ATTRIBUTE = 'data-floating-owner-ids';

export const useFloatingRoot = (): HTMLElement | undefined => {
    return useContext(FloatingRootContext);
};

export const useTopLayerRoot = (): HTMLElement | undefined => {
    return useContext(TopLayerRootContext);
};

export const useFloatingOwnerIds = (): string[] => {
    return useContext(FloatingOwnerIdsContext);
};

export const appendFloatingOwnerIds = (ownerIds: string[], ownerId: string): string[] => {
    if (!ownerId) {
        return ownerIds;
    }

    return [...ownerIds, ownerId];
};

export const getFloatingOwnerIdsAttribute = (ownerIds: string[]): string | undefined => {
    if (!ownerIds.length) {
        return undefined;
    }

    return ownerIds.join(' ');
};

export const hasFloatingOwnerId = (element: Element | null, ownerId: string): boolean => {
    if (!element || !ownerId) {
        return false;
    }

    const ownerIdsValue = element
        .closest<HTMLElement>(`[${FLOATING_OWNER_IDS_ATTRIBUTE}]`)
        ?.getAttribute(FLOATING_OWNER_IDS_ATTRIBUTE);

    if (!ownerIdsValue) {
        return false;
    }

    return ownerIdsValue.split(/\s+/).includes(ownerId);
};

export default FloatingRootContext;
