import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { normalizePortMapping } from './port-mapping';
import type { ContainerTemplate } from '@/modules/container/contracts/templates';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';

const DOCKER_IMAGE_REFERENCE_PATTERN = /^(?:(?:[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)(?:\/[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)*)(?::[\w][\w.-]{0,127})?(?:@[A-Za-z][A-Za-z0-9]*:[0-9a-fA-F]{32,})?$/;

interface TemplateConfiguration {
    ports: PortMapping[];
    env: EnvVariable[];
    mountDockerSocket: boolean;
}

export const getContainerTemplateById = (templateId: string) => {
    return CONTAINER_TEMPLATES.find((containerTemplate) => containerTemplate.id === templateId);
};

export const getCreatePorts = (ports: PortMapping[]): PortMapping[] => {
    return ports
        .filter((port) => port.private > 0)
        .map(normalizePortMapping);
};

export const getTemplateConfiguration = (template: ContainerTemplate): TemplateConfiguration => {
    return {
        ports: template.defaultPort ? [{ private: template.defaultPort }] : [],
        env: [...(template.defaultEnv ?? [])],
        mountDockerSocket: template.id === 'coder'
    };
};

/** Dedupes by key, last writer wins, dropping entries the user left half-filled. */
export const mergeContainerEnvVariables = (envVariables: EnvVariable[]): EnvVariable[] => {
    const mergedEnvVariables = new Map<string, EnvVariable>();

    envVariables
        .filter((envVariable) => envVariable.key && envVariable.value)
        .forEach((envVariable) => {
            mergedEnvVariables.set(envVariable.key, envVariable);
        });

    return Array.from(mergedEnvVariables.values());
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
