import { useOutletContext } from 'react-router-dom';
import type { Container } from '../api/entities/container';
import type { EnvVariable } from '../api/entities/env-variable';
import type { PortMapping } from '../api/entities/port-mapping';
import type { ContainerStatsViewData } from '../api/entities/container-stats-view';

export interface ContainerDetailsContext {
    container: Container;
    stats: ContainerStatsViewData;
    isRunning: boolean;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
};

const useContainerDetailsContext = () => {
    return useOutletContext<ContainerDetailsContext>();
};

export default useContainerDetailsContext;
