import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Container } from '@volt/contracts/modules/container/domain';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { ContainerStatsViewData } from '../services/container-stats-view';

export interface ContainerDetailsContext {
    container: Container;
    stats: ContainerStatsViewData;
    isRunning: boolean;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
    setHeaderActions: (actions: ReactNode) => void;
}

const useContainerDetailsContext = () => {
    return useOutletContext<ContainerDetailsContext>();
};

export const useContainerHeaderActions = (actions: ReactNode) => {
    const { setHeaderActions } = useContainerDetailsContext();

    useEffect(() => {
        setHeaderActions(actions);
        return () => setHeaderActions(null);
    }, [actions, setHeaderActions]);
};

export default useContainerDetailsContext;
