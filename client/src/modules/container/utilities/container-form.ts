import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { ContainerTemplateCustomFieldType } from '../api/entities/container-template';
import type {
    ContainerTemplate,
    ContainerTemplateCustomField,
    ContainerTemplateCustomFieldValues
} from '../api/entities/container-template';
import type { EnvVariable } from '../api/entities/env-variable';
import type { PortMapping } from '../api/entities/port-mapping';

const DOCKER_IMAGE_REFERENCE_PATTERN = /^(?:(?:[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)(?:\/[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)*)(?::[\w][\w.-]{0,127})?(?:@[A-Za-z][A-Za-z0-9]*:[0-9a-fA-F]{32,})?$/;

interface TemplateConfiguration {
    ports: PortMapping[];
    env: EnvVariable[];
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    mountDockerSocket: boolean;
}

/** Validates one template custom field against required and pattern rules. */
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

const getTemplatePorts = (template: ContainerTemplate): PortMapping[] => {
    if (!template.defaultPort) {
        return [];
    }

    return [{
        private: template.defaultPort
    }];
};

export const getCreatePorts = (ports: PortMapping[]): PortMapping[] => {
    return ports
        .filter((port) => port.private > 0)
        .map((port) => {
            if (port.public === undefined) {
                return { private: port.private };
            }

            return {
                private: port.private,
                public: port.public
            };
        });
};

const getTemplateEnv = (template: ContainerTemplate): EnvVariable[] => {
    if (!template.defaultEnv) {
        return [];
    }

    return [...template.defaultEnv];
};

const getTemplateCustomFields = (template: ContainerTemplate): ContainerTemplateCustomField[] => {
    if (!template.customFields) {
        return [];
    }

    return [...template.customFields];
};

const getTemplateCustomFieldValues = (template: ContainerTemplate): ContainerTemplateCustomFieldValues => {
    const customFieldValues: ContainerTemplateCustomFieldValues = {};

    template.customFields?.forEach((customField) => {
        customFieldValues[customField.id] = customField.defaultValue ?? '';
    });

    return customFieldValues;
};

export const getTemplateConfiguration = (template: ContainerTemplate): TemplateConfiguration => {
    return {
        ports: getTemplatePorts(template),
        env: getTemplateEnv(template),
        customFields: getTemplateCustomFields(template),
        customFieldValues: getTemplateCustomFieldValues(template),
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

export const hasInvalidCustomField = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerTemplateCustomFieldValues
) => {
    return customFields.some((customField) => {
        return getCustomFieldValidationError(customField, customFieldValues[customField.id] ?? '') !== null;
    });
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
