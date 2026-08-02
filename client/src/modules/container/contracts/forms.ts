import type { EnvVariable, PortMapping } from '@volt/contracts/modules/container/domain';
import type { ContainerTemplateCustomField, ContainerTemplateCustomFieldValues } from './templates';

export interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
}

export interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
}

/** Everything the create-container form collects before it becomes a create request. */
export interface ContainerConfig {
    name: string;
    memory: number;
    cpus: number;
    ports: PortMapping[];
    env: EnvVariable[];
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    mountDockerSocket: boolean;
}
