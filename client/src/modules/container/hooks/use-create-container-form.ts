import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { containerQuery } from './queries';
import useTeamClusterResourceSelection from './use-team-cluster-resource-selection';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { ClusterResourceLimits } from '../api/entities/cluster-resource-limits';
import { ContainerTemplateCustomFieldType } from '../api/entities/container-template';
import type {
    ContainerTemplate,
    ContainerTemplateCustomField,
    ContainerTemplateCustomFieldValues
} from '../api/entities/container-template';
import type { EnvVariable } from '../api/entities/env-variable';
import type { PortMapping } from '../api/entities/port-mapping';
import type { TeamClusterOption } from '../api/entities/team-cluster-option';
import type { Team } from '@/modules/team/api/entities/team/team';
import { v4 as uuidv4 } from 'uuid';
import { MIN_CLUSTER_CPU, MIN_CLUSTER_MEMORY_MB, clampClusterResourceValue } from '../utilities/resource-allocation';
export type { EnvVariable } from '../api/entities/env-variable';
export type { PortMapping } from '../api/entities/port-mapping';

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 512;
const CREATE_CONTAINER_DRAFT_STORAGE_KEY = 'volt:create-container:draft';
const DOCKER_IMAGE_REFERENCE_PATTERN = /^(?:(?:[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)(?:\/[a-z0-9]+(?:(?:[._-][a-z0-9]+)+)?)*)(?::[\w][\w.-]{0,127})?(?:@[A-Za-z][A-Za-z0-9]*:[0-9a-fA-F]{32,})?$/;

interface ContainerDeployProgressEvent {
    operationId: string;
    teamClusterId: string;
    teamId: string;
    stage: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
    timestamp: string;
}

interface CreateContainerDraft {
    selectedTemplate: string | null;
    customImage: string;
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    config: ContainerConfig;
    savedAt: number;
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

interface TemplateConfiguration {
    ports: PortMapping[];
    env: EnvVariable[];
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    mountDockerSocket: boolean;
}

const getContainerTemplateById = (templateId: string) => {
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

const getCreatePorts = (ports: PortMapping[]): PortMapping[] => {
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

const getTemplateConfiguration = (template: ContainerTemplate): TemplateConfiguration => {
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

const hasInvalidCustomField = (
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

export interface UseCreateContainerFormReturn {
    config: ContainerConfig;
    selectedTemplate: string | null;
    customImage: string;
    customImageError: string | null;
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    clusterResourceLimits: ClusterResourceLimits | null;
    isLoadingResourceLimits: boolean;
    isLoading: boolean;
    deployProgressMessage: string | null;
    draftLastSavedAt: number | null;
    setSelectedTeamId: (id: string | null) => void;
    setSelectedTeamClusterId: (id: string | null) => void;
    updateConfig: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    handleTemplateSelect: (templateId: string) => void;
    setCustomImage: (image: string) => void;
    handleCreate: () => Promise<void>;
    getSelectedImage: () => string | undefined;
    getSelectedTemplate: () => ContainerTemplate | undefined;
    canProceedToConfig: boolean;
    canProceedToReview: boolean;
}

const useCreateContainerForm = (): UseCreateContainerFormReturn => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const createContainerMutation = containerQuery.useCreateMutation();
    const currentFolderId = searchParams.get('folderId');

    const teams = useTeamsQuery(undefined).data ?? [];
    const selectedTeam = useSelectedTeam();

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customImage, setCustomImageState] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(selectedTeam?._id || null);
    const [selectedTeamClusterId, setSelectedTeamClusterId] = useState<string | null>(null);
    const [activeCreateOperationId, setActiveCreateOperationId] = useState<string | null>(null);
    const [deployProgressMessage, setDeployProgressMessage] = useState<string | null>(null);
    const [draftLastSavedAt, setDraftLastSavedAt] = useState<number | null>(null);
    const {
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits
    } = useTeamClusterResourceSelection({
        teamId: selectedTeamId,
        selectedTeamClusterId,
        onSelectedTeamClusterIdChange: setSelectedTeamClusterId
    });
    const hasResolvedResourceLimits = typeof clusterResourceLimits?.maxCpus === 'number'
        && typeof clusterResourceLimits?.maxMemoryMB === 'number';

    const deployStepMessageMap = useMemo<Record<string, string>>(() => ({
        accepted: 'Deployment request accepted.',
        'pulling-image': 'Pulling image. This can take a while the first time.',
        'creating-container': 'Creating container...',
        'starting-container': 'Starting container...',
        'container-ready': 'Container is ready.'
    }), []);

    useSocketEvent<ContainerDeployProgressEvent>(SOCKET_CONTAINER_EVENTS.DEPLOY_PROGRESS, (event) => {
        if (!activeCreateOperationId || event.operationId !== activeCreateOperationId) {
            return;
        }

        const nextMessage = event.step
            ? deployStepMessageMap[event.step] ?? `Deploying container: ${event.step}`
            : 'Deploying container...';

        setDeployProgressMessage(nextMessage);
    }, {
        enabled: !!activeCreateOperationId
    });

    const [config, setConfig] = useState<ContainerConfig>({
        name: '',
        memory: DEFAULT_MEMORY,
        cpus: DEFAULT_CPU,
        ports: [],
        env: [],
        customFields: [],
        customFieldValues: {},
        mountDockerSocket: false
    });
    const customImageError = useMemo(() => {
        if (!customImage) {
            return null;
        }

        return getCustomImageValidationError(customImage);
    }, [customImage]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const rawDraft = window.localStorage.getItem(CREATE_CONTAINER_DRAFT_STORAGE_KEY);
            if (!rawDraft) {
                return;
            }

            const draft = JSON.parse(rawDraft) as Partial<CreateContainerDraft>;
            if (draft.selectedTemplate !== undefined) {
                setSelectedTemplate(draft.selectedTemplate ?? null);
            }
            if (typeof draft.customImage === 'string') {
                setCustomImageState(draft.customImage);
            }
            if (draft.selectedTeamId !== undefined) {
                setSelectedTeamId(draft.selectedTeamId ?? null);
            }
            if (draft.selectedTeamClusterId !== undefined) {
                setSelectedTeamClusterId(draft.selectedTeamClusterId ?? null);
            }
            if (draft.config) {
                setConfig((previousConfig) => ({
                    ...previousConfig,
                    ...draft.config
                }));
            }
            if (typeof draft.savedAt === 'number') {
                setDraftLastSavedAt(draft.savedAt);
            }
        } catch {
            window.localStorage.removeItem(CREATE_CONTAINER_DRAFT_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        if (selectedTeam && !selectedTeamId) {
            setSelectedTeamId(selectedTeam._id);
        }
    }, [selectedTeam, selectedTeamId]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const savedAt = Date.now();
        const draft: CreateContainerDraft = {
            selectedTemplate,
            customImage,
            selectedTeamId,
            selectedTeamClusterId,
            config,
            savedAt
        };

        window.localStorage.setItem(CREATE_CONTAINER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setDraftLastSavedAt(savedAt);
    }, [config, customImage, selectedTeamClusterId, selectedTeamId, selectedTemplate]);

    useEffect(() => {
        setConfig((previousConfig) => ({
            ...previousConfig,
            cpus: clampClusterResourceValue(previousConfig.cpus, MIN_CLUSTER_CPU, clusterResourceLimits?.maxCpus),
            memory: clampClusterResourceValue(previousConfig.memory, MIN_CLUSTER_MEMORY_MB, clusterResourceLimits?.maxMemoryMB)
        }));
    }, [clusterResourceLimits?.maxCpus, clusterResourceLimits?.maxMemoryMB]);

    const updateConfig = useCallback(<K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => {
        setConfig((previousConfig) => ({
            ...previousConfig,
            [key]: value
        }));
    }, []);

    const handleTemplateSelect = useCallback((templateId: string) => {
        const template = getContainerTemplateById(templateId);
        if (!template) {
            return;
        }

        const templateConfiguration = getTemplateConfiguration(template);

        setSelectedTemplate(templateId);
        setCustomImageState('');
        setConfig((previousConfig) => ({
            ...previousConfig,
            name: `${template.id}-${Math.floor(Math.random() * 1000)}`,
            ports: templateConfiguration.ports,
            env: templateConfiguration.env,
            customFields: templateConfiguration.customFields,
            customFieldValues: templateConfiguration.customFieldValues,
            mountDockerSocket: templateConfiguration.mountDockerSocket
        }));
    }, []);

    const setCustomImage = useCallback((image: string) => {
        const trimmedImage = image.trim();

        if (!trimmedImage) {
            sileo.error({ title: 'Please enter a valid image name' });
            return;
        }

        const validationError = getCustomImageValidationError(trimmedImage);
        if (validationError) {
            sileo.error({ title: 'Invalid image reference', description: validationError });
            return;
        }

        setCustomImageState(trimmedImage);
        setSelectedTemplate(null);
        setConfig((previousConfig) => ({
            ...previousConfig,
            name: `custom-${Math.floor(Math.random() * 1000)}`,
            customFields: [],
            customFieldValues: {},
            mountDockerSocket: false
        }));
    }, []);

    const getSelectedImage = useCallback(() => {
        if (selectedTemplate) {
            return getContainerTemplateById(selectedTemplate)?.image;
        }

        return customImage || undefined;
    }, [selectedTemplate, customImage]);

    const getSelectedTemplate = useCallback(() => {
        if (selectedTemplate) {
            return getContainerTemplateById(selectedTemplate);
        }

        return undefined;
    }, [selectedTemplate]);

    const handleCreate = useCallback(async () => {
        const image = getSelectedImage();
        const template = getSelectedTemplate();

        if (!image) {
            sileo.error({ title: 'Please select a template or specify an image' });
            return;
        }

        if (!config.name) {
            sileo.error({ title: 'Please give your container a name' });
            return;
        }

        if (!selectedTeamId) {
            sileo.error({ title: 'Please select a team for this container' });
            return;
        }

        if (!selectedTeamClusterId) {
            sileo.error({ title: 'Please select a cluster for this container' });
            return;
        }

        if (hasInvalidCustomField(config.customFields, config.customFieldValues)) {
            sileo.error({ title: 'Please correct the template settings before creating the container' });
            return;
        }

        await showPromise(
            (() => {
                const operationId = uuidv4();
                setActiveCreateOperationId(operationId);
                setDeployProgressMessage('Preparing deployment...');

                return createContainerMutation.mutateAsync({
                    teamId: selectedTeamId,
                    teamClusterId: selectedTeamClusterId,
                    folderId: currentFolderId,
                    operationId,
                    name: config.name,
                    image,
                    memory: config.memory,
                    cpus: config.cpus,
                    ports: getCreatePorts(config.ports),
                    env: mergeContainerEnvVariables(config.env, config.customFields, config.customFieldValues),
                    mountDockerSocket: config.mountDockerSocket,
                    useImageCmd: template?.useImageCmd,
                    cmd: template?.defaultCmd
                }).finally(() => {
                    setActiveCreateOperationId(null);
                });
            })(),
            {
                loading: {
                    title: 'Deploying container...',
                    description: 'Waiting for real-time deployment updates from the cluster.'
                },
                success: { title: 'Container created successfully' },
                error: { title: 'Failed to create container' }
            }
        );
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(CREATE_CONTAINER_DRAFT_STORAGE_KEY);
        }
        const nextPath = currentFolderId
            ? `/dashboard/containers?folderId=${encodeURIComponent(currentFolderId)}`
            : '/dashboard/containers';
        navigate(nextPath);
    }, [config, selectedTeamClusterId, selectedTeamId, currentFolderId, getSelectedImage, getSelectedTemplate, createContainerMutation, navigate]);

    return {
        config,
        selectedTemplate,
        customImage,
        customImageError,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading: createContainerMutation.isPending,
        deployProgressMessage,
        draftLastSavedAt,
        setSelectedTeamId,
        setSelectedTeamClusterId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
        getSelectedImage,
        getSelectedTemplate,
        canProceedToConfig: !!(selectedTemplate || customImage),
        canProceedToReview: Boolean(
            config.name.trim()
            && selectedTeamId
            && selectedTeamClusterId
            && !isLoadingResourceLimits
            && hasResolvedResourceLimits
            && (selectedTemplate || customImage)
            && !hasInvalidCustomField(config.customFields, config.customFieldValues)
        )
    };
};

export default useCreateContainerForm;
