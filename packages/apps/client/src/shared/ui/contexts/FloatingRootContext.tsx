import { createContext, useContext } from 'react';

const FloatingRootContext = createContext<HTMLElement | undefined>(undefined);
export const TopLayerRootContext = createContext<HTMLElement | undefined>(undefined);
export const FloatingOwnerIdsContext = createContext<string[]>([]);
const FLOATING_OWNER_IDS_ATTRIBUTE = 'data-floating-owner-ids';

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
