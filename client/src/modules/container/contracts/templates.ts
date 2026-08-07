import type { EnvVariable } from '@volt/contracts/modules/container/domain';

export interface ContainerTemplate {
    id: string;
    name: string;
    image: string;
    logo: string;
    description: string;
    category?: string;
    defaultPort?: number;
    defaultEnv?: EnvVariable[];
    defaultCmd?: string[];
    useImageCmd?: boolean;
}
