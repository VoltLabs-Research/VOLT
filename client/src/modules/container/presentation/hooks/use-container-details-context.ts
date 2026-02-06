import { useOutletContext } from 'react-router-dom';
import type { Container, EnvVariable, PortMapping } from '@/modules/container/domain/entities';
import type { CpuData } from '../components/molecules/CpuChart';
import type { MemoryData } from '../components/molecules/MemoryChart';
import type { NetworkData } from '@/shared/presentation/components/NetworkChart';

export interface ContainerDetailsContext {
    container: Container;
    stats: {
        cpu: CpuData | null;
        memory: MemoryData | null;
        network: NetworkData | null;
    };
    isRunning: boolean;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
};

const useContainerDetailsContext = () => {
    return useOutletContext<ContainerDetailsContext>();
};

export default useContainerDetailsContext;
