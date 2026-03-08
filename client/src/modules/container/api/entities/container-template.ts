import type { EnvVariable } from '@/modules/container/api/entities/env-variable';

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
};
