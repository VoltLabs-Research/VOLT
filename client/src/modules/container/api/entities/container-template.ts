import type { ContainerCapabilities } from './container-capabilities';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';

export interface ContainerTemplateCustomFieldValues {
    [fieldId: string]: string;
};

export enum ContainerTemplateCustomFieldType {
    Text = 'text',
    Password = 'password'
};

export interface ContainerTemplateCustomFieldEnvMapping {
    key: string;
};

export interface ContainerTemplateCustomField {
    id: string;
    label: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    pattern?: string;
    patternError?: string;
    type: ContainerTemplateCustomFieldType;
    env?: ContainerTemplateCustomFieldEnvMapping;
};

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
    capabilities?: ContainerCapabilities;
    customFields?: ContainerTemplateCustomField[];
};
