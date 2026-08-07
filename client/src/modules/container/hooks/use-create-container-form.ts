import { containerQuery } from './queries';
import useTeamClusterResourceSelection from './use-team-cluster-resource-selection';
import useContainerDeployProgress from './use-container-deploy-progress';
import useCreateContainerDraft from './use-create-container-draft';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/ui/hooks/toast';
import { sileo } from 'sileo';
import type { ContainerConfig } from '../contracts/forms';
import type { CreateContainerDraft } from './use-create-container-draft';
import { MIN_CLUSTER_CPU, MIN_CLUSTER_MEMORY_MB, clampClusterResourceValue } from '../utils/resource-allocation';
import {
    getContainerTemplateById,
    getTemplateConfiguration,
    getCreatePorts,
    mergeContainerEnvVariables,
    getCustomImageValidationError
} from '../utils/container-form';

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 512;

const useCreateContainerForm = () => {
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
    const [config, setConfig] = useState<ContainerConfig>({
        name: '',
        memory: DEFAULT_MEMORY,
        cpus: DEFAULT_CPU,
        ports: [],
        env: [],
        mountDockerSocket: false
    });

    const deployProgress = useContainerDeployProgress();
    const {
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits
    } = useTeamClusterResourceSelection({
        teamId: selectedTeamId,
        selectedTeamClusterId,
        onSelectedTeamClusterIdChange: setSelectedTeamClusterId
    });
    const hasResolvedResourceLimits = clusterResourceLimits?.maxCpus != null
        && clusterResourceLimits?.maxMemoryMB != null;

    const restoreDraft = useCallback((draft: CreateContainerDraft) => {
        setSelectedTemplate(draft.selectedTemplate ?? null);
        setCustomImageState(draft.customImage ?? '');
        setSelectedTeamId(draft.selectedTeamId ?? null);
        setSelectedTeamClusterId(draft.selectedTeamClusterId ?? null);
        setConfig((previousConfig) => ({
            ...previousConfig,
            ...draft.config
        }));
    }, []);

    const { lastSavedAt: draftLastSavedAt, clearDraft } = useCreateContainerDraft({
        draft: {
            selectedTemplate,
            customImage,
            selectedTeamId,
            selectedTeamClusterId,
            config
        },
        onRestore: restoreDraft
    });

    useEffect(() => {
        if (selectedTeam && !selectedTeamId) {
            setSelectedTeamId(selectedTeam._id);
        }
    }, [selectedTeam, selectedTeamId]);

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
            ...templateConfiguration
        }));
    }, []);

    const setCustomImage = useCallback((image: string) => {
        const trimmedImage = image.trim();
        const validationError = getCustomImageValidationError(trimmedImage);

        if (validationError) {
            sileo.error({
                title: 'Invalid image reference',
                description: validationError
            });
            return;
        }

        setCustomImageState(trimmedImage);
        setSelectedTemplate(null);
        setConfig((previousConfig) => ({
            ...previousConfig,
            name: `custom-${Math.floor(Math.random() * 1000)}`,
            mountDockerSocket: false
        }));
    }, []);

    const selectedTemplateEntity = selectedTemplate ? getContainerTemplateById(selectedTemplate) : undefined;
    const image = selectedTemplateEntity?.image ?? (customImage || undefined);
    const handleCreate = async () => {
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

        const operationId = deployProgress.startTracking();

        await showPromise(
            createContainerMutation.mutateAsync({
                teamId: selectedTeamId,
                teamClusterId: selectedTeamClusterId,
                folderId: currentFolderId,
                operationId,
                name: config.name,
                image,
                memory: config.memory,
                cpus: config.cpus,
                ports: getCreatePorts(config.ports),
                env: mergeContainerEnvVariables(config.env),
                mountDockerSocket: config.mountDockerSocket,
                useImageCmd: selectedTemplateEntity?.useImageCmd,
                cmd: selectedTemplateEntity?.defaultCmd
            }).finally(deployProgress.stopTracking),
            {
                loading: {
                    title: 'Deploying container...',
                    description: 'Waiting for real-time deployment updates from the cluster.'
                },
                success: { title: 'Container created successfully' },
                error: { title: 'Failed to create container' }
            }
        );

        clearDraft();
        navigate(currentFolderId
            ? `/dashboard/containers?folderId=${encodeURIComponent(currentFolderId)}`
            : '/dashboard/containers');
    };

    return {
        config,
        selectedTemplate,
        selectedTemplateEntity,
        customImage,
        customImageError: customImage ? getCustomImageValidationError(customImage) : null,
        image,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading: createContainerMutation.isPending,
        deployProgressMessage: deployProgress.message,
        deployProgressRate: deployProgress.rate,
        deployStartedAt: deployProgress.startedAt,
        draftLastSavedAt,
        setSelectedTeamId,
        setSelectedTeamClusterId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
        canProceedToConfig: !!(selectedTemplate || customImage),
        canProceedToReview: Boolean(
            config.name.trim()
            && selectedTeamId
            && selectedTeamClusterId
            && !isLoadingResourceLimits
            && hasResolvedResourceLimits
            && (selectedTemplate || customImage)
        )
    };
};

export default useCreateContainerForm;
