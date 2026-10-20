import { UNSAFE_PortalProvider } from 'react-aria';
import FloatingRootContext, { TopLayerRootContext } from '@/shared/ui/contexts/FloatingRootContext';
import { createContext, useCallback } from 'react';
import type { ReactNode } from 'react';

const ModalTopLayerContext = createContext<HTMLElement | null>(null);

interface ModalTopLayerProps {
    root: HTMLElement | null;
    children: ReactNode;
}

export const ModalTopLayer = ({ root, children }: ModalTopLayerProps) => {
    const getContainer = useCallback(() => root ?? document.body, [root]);

    return (
        <ModalTopLayerContext.Provider value={root}>
            <UNSAFE_PortalProvider getContainer={getContainer}>
                <FloatingRootContext.Provider value={root ?? undefined}>
                    <TopLayerRootContext.Provider value={root ?? undefined}>
                        {children}
                    </TopLayerRootContext.Provider>
                </FloatingRootContext.Provider>
            </UNSAFE_PortalProvider>
        </ModalTopLayerContext.Provider>
    );
};
