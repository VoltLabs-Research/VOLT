import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { normalizePortMapping } from './port-mapping';
import { ContainerTemplateCustomFieldType } from '@/modules/container/contracts/templates';
import type {
    ContainerTemplate,
    ContainerTemplateCustomField,
    ContainerTemplateCustomFieldValues
} from '@/modules/container/contracts/templates';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';

const DOCKER_IMAGE_REFERENCE_PATTERN = /^(?:(?:[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)(?:\/[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)*)(?::[\w][\w.-]{0,127})?(?:@[A-Za-z][A-Za-z0-9]*:[0-9a-fA-F]{32,})?$/;

interface TemplateConfiguration {
    ports: PortMapping[];
    env: EnvVariable[];
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    mountDockerSocket: boolean;
}

export const getCustomFieldValidationError = (
    customField: ContainerTemplateCustomField,
    value: string
) => {
    if (customField.required && !value.trim()) {
        return `${customField.label} is required.`;
    }

    if (!value.trim() || !customField.pattern) {
        return null;
    }

    const validationPattern = new RegExp(customField.pattern);
    if (!validationPattern.test(value)) {
        return customField.patternError ?? `${customField.label} is invalid.`;
    }

    return null;
};

export const getContainerTemplateById = (templateId: string) => {
    return CONTAINER_TEMPLATES.find((containerTemplate) => containerTemplate.id === templateId);
};

export const getCreatePorts = (ports: PortMapping[]): PortMapping[] => {
    return ports
        .filter((port) => port.private > 0)
        .map(normalizePortMapping);
};

export const getTemplateConfiguration = (template: ContainerTemplate): TemplateConfiguration => {
    const customFields = template.customFields ?? [];
    const customFieldValues: ContainerTemplateCustomFieldValues = {};

    customFields.forEach((customField) => {
        customFieldValues[customField.id] = customField.defaultValue ?? '';
    });

    return {
        ports: template.defaultPort ? [{ private: template.defaultPort }] : [],
        env: [...(template.defaultEnv ?? [])],
        customFields: [...customFields],
        customFieldValues,
        mountDockerSocket: template.id === 'coder'
    };
};

const getMappedCustomFieldEnv = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerTemplateCustomFieldValues
): EnvVariable[] => {
    return customFields.reduce<EnvVariable[]>((envVariables, customField) => {
        if (!customField.env) {
            return envVariables;
        }

        const value = customFieldValues[customField.id] ?? '';
        if (!value) {
            return envVariables;
        }

        envVariables.push({
            key: customField.env.key,
            value
        });

        return envVariables;
    }, []);
};

export const mergeContainerEnvVariables = (
    envVariables: EnvVariable[],
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerTemplateCustomFieldValues
): EnvVariable[] => {
    const mergedEnvVariables = new Map<string, EnvVariable>();

    envVariables
        .filter((envVariable) => envVariable.key && envVariable.value)
        .forEach((envVariable) => {
            mergedEnvVariables.set(envVariable.key, envVariable);
        });

    getMappedCustomFieldEnv(customFields, customFieldValues).forEach((envVariable) => {
        mergedEnvVariables.set(envVariable.key, envVariable);
    });

    return Array.from(mergedEnvVariables.values());
};

export const getCustomFieldValidationErrorCount = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerTemplateCustomFieldValues
): number => {
    return customFields.reduce((count, customField) => {
        const value = customFieldValues[customField.id] ?? '';
        return getCustomFieldValidationError(customField, value) ? count + 1 : count;
    }, 0);
};

export const getMaskedCustomFieldValue = (customField: ContainerTemplateCustomField, value: string) => {
    if (customField.type === ContainerTemplateCustomFieldType.Password && value) {
        return '••••••••';
    }

    return value;
};

export const getCustomImageValidationError = (image: string): string | null => {
    const trimmedImage = image.trim();

    if (!trimmedImage) {
        return 'Please enter a Docker image reference.';
    }

    if (!DOCKER_IMAGE_REFERENCE_PATTERN.test(trimmedImage)) {
        return 'Use a valid Docker image reference, for example nginx:latest or ghcr.io/org/image:tag.';
    }

    return null;
};
