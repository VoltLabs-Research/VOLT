import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { containerQuery } from './queries';
import { teamClusterService } from '../api/service/team-cluster-service';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { ClusterResourceLimits } from '../api/entities/cluster-resource-limits';
import { ContainerTemplateCustomFieldType } from '../api/entities/container-template';
import type { ContainerTemplate } from '../api/entities/container-template';
import type { ContainerTemplateCustomField } from '../api/entities/container-template';
import type { ContainerTemplateCustomFieldValues } from '../api/entities/container-template';
import type { EnvVariable } from '../api/entities/env-variable';
import type { PortMapping } from '../api/entities/port-mapping';
import type { TeamClusterOption } from '../api/entities/team-cluster-option';
import type { Team } from '@/modules/team/api/entities/team/team';
import { v4 as uuidv4 } from 'uuid';

export type { EnvVariable } from '../api/entities/env-variable';
export type { PortMapping } from '../api/entities/port-mapping';

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 512;
const MIN_CPU = 0.5;
const MIN_MEMORY = 128;

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
};

const clampResourceValue = (value: number, min: number, max: number | null | undefined) => {
    if (typeof max !== 'number' || !Number.isFinite(max)) {
        return Math.max(value, min);
    }

    return Math.min(Math.max(value, min), Math.max(min, max));
};

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
};

interface TemplateConfiguration {
    ports: PortMapping[];
    env: EnvVariable[];
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    mountDockerSocket: boolean;
};

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

export interface UseCreateContainerFormReturn {
    config: ContainerConfig;
    selectedTemplate: string | null;
    customImage: string;
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    clusterResourceLimits: ClusterResourceLimits | null;
    isLoadingResourceLimits: boolean;
    isLoading: boolean;
    deployProgressMessage: string | null;
    setSelectedTeamId: (id: string | null) => void;
    setSelectedTeamClusterId: (id: string | null) => void;
    updateConfig: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    handleTemplateSelect: (templateId: string) => void;
    setCustomImage: (image: string, goToConfigFunction: () => void) => void;
    handleCreate: () => Promise<void>;
    getSelectedImage: () => string | undefined;
    getSelectedTemplate: () => ContainerTemplate | undefined;
    canProceedToConfig: boolean;
    canProceedToReview: boolean;
};

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
    const [teamClusters, setTeamClusters] = useState<TeamClusterOption[]>([]);
    const [clusterResourceLimits, setClusterResourceLimits] = useState<ClusterResourceLimits | null>(null);
    const [isLoadingResourceLimits, setIsLoadingResourceLimits] = useState(false);
    const [activeCreateOperationId, setActiveCreateOperationId] = useState<string | null>(null);
    const [deployProgressMessage, setDeployProgressMessage] = useState<string | null>(null);
    const hasResolvedResourceLimits = typeof clusterResourceLimits?.maxCpus === 'number'
        && typeof clusterResourceLimits?.maxMemoryMB === 'number';

    const deployStepMessageMap = useMemo<Record<string, string>>(() => ({
        accepted: 'Deployment request accepted.',
        'pulling-image': 'Pulling image. This can take a while the first time.',
        'creating-container': 'Creating container...',
        'starting-container': 'Starting container...',
        'container-ready': 'Container is ready.'
    }), []);

    useSocketEvent<ContainerDeployProgressEvent>('container.deploy.progress', (event) => {
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

    useEffect(() => {
        if (selectedTeam && !selectedTeamId) {
            setSelectedTeamId(selectedTeam._id);
        }
    }, [selectedTeam, selectedTeamId]);

    useEffect(() => {
        if (!selectedTeamId) {
            setTeamClusters([]);
            setSelectedTeamClusterId(null);
            setClusterResourceLimits(null);
            setIsLoadingResourceLimits(false);
            return;
        }

        let cancelled = false;

        teamClusterService.listByTeamId(selectedTeamId)
            .then((clusters) => {
                if (cancelled) {
                    return;
                }

                setTeamClusters(clusters);
                setSelectedTeamClusterId((currentTeamClusterId) => {
                    if (currentTeamClusterId && clusters.some((cluster) => cluster._id === currentTeamClusterId)) {
                        return currentTeamClusterId;
                    }

                    return clusters[0]?._id || null;
                });
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setTeamClusters([]);
                setSelectedTeamClusterId(null);
                setClusterResourceLimits(null);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedTeamId]);

    useEffect(() => {
        if (!selectedTeamId || !selectedTeamClusterId) {
            setClusterResourceLimits(null);
            setIsLoadingResourceLimits(false);
            return;
        }

        let cancelled = false;
        setIsLoadingResourceLimits(true);

        teamClusterService.getResourceLimits(selectedTeamId, selectedTeamClusterId)
            .then((resourceLimits) => {
                if (cancelled) {
                    return;
                }

                setClusterResourceLimits(resourceLimits);
                setConfig((previousConfig) => ({
                    ...previousConfig,
                    cpus: clampResourceValue(previousConfig.cpus, MIN_CPU, resourceLimits.maxCpus),
                    memory: clampResourceValue(previousConfig.memory, MIN_MEMORY, resourceLimits.maxMemoryMB)
                }));
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setClusterResourceLimits(null);
            })
            .finally(() => {
                if (cancelled) {
                    return;
                }

                setIsLoadingResourceLimits(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedTeamId, selectedTeamClusterId]);

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

    const setCustomImage = useCallback((image: string, goToConfigFunction: () => void) => {
        const trimmedImage = image.trim();

        if (!trimmedImage) {
            sileo.error({ title: 'Please enter a valid image name' });
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
        goToConfigFunction();
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
                    cmd: template?.defaultCmd,
                    capabilities: template?.capabilities
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
        await queryClient.invalidateQueries({ queryKey: containerQuery.QUERY_KEYS.lists() });
        const nextPath = currentFolderId
            ? `/dashboard/containers?folderId=${encodeURIComponent(currentFolderId)}`
            : '/dashboard/containers';
        navigate(nextPath);
    }, [config, selectedTeamClusterId, selectedTeamId, currentFolderId, getSelectedImage, getSelectedTemplate, createContainerMutation, navigate]);

    return {
        config,
        selectedTemplate,
        customImage,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading: createContainerMutation.isPending,
        deployProgressMessage,
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
