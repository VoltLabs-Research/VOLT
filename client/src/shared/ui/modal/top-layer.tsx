import { UNSAFE_PortalProvider } from 'react-aria';
import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';

const ModalTopLayerContext = createContext<HTMLElement | null>(null);

export const useModalTopLayerRoot = (): HTMLElement | null => {
    return useContext(ModalTopLayerContext);
};

interface ModalTopLayerProps {
    root: HTMLElement | null;
    children: ReactNode;
}

export const ModalTopLayer = ({ root, children }: ModalTopLayerProps) => {
    const getContainer = useCallback(() => root ?? document.body, [root]);

    return (
        <ModalTopLayerContext.Provider value={root}>
            <UNSAFE_PortalProvider getContainer={getContainer}>
                {children}
            </UNSAFE_PortalProvider>
        </ModalTopLayerContext.Provider>
    );
};
