import { CONTAINER_TEMPLATES } from '../services/container-templates';
import { containerQuery } from './queries';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { EnvVariable } from '../api/entities/env-variable';
import type { PortMapping } from '../api/entities/port-mapping';
import type { ContainerTemplate } from '../api/entities/container-template';

export type { EnvVariable } from '../api/entities/env-variable';
export type { PortMapping } from '../api/entities/port-mapping';

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 512;

export interface ContainerConfig {
    name: string;
    memory: number;
    cpus: number;
    ports: PortMapping[];
    env: EnvVariable[];
    mountDockerSocket: boolean;
};

export interface UseCreateContainerFormReturn {
    config: ContainerConfig;
    selectedTemplate: string | null;
    customImage: string;
    selectedTeamId: string | null;
    teams: Team[];
    isLoading: boolean;
    setSelectedTeamId: (id: string | null) => void;
    updateConfig: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    handleTemplateSelect: (templateId: string) => void;
    setCustomImage: (image: string, goToConfig: () => void) => void;
    handleCreate: () => Promise<void>;
    getSelectedImage: () => string | undefined;
    getSelectedTemplate: () => ContainerTemplate | undefined;
    canProceedToConfig: boolean;
};

const useCreateContainerForm = (goToConfig: () => void): UseCreateContainerFormReturn => {
    const navigate = useNavigate();
    const createContainerMutation = containerQuery.useCreateMutation();

    const teams = useTeamsQuery(undefined).data ?? [];
    const selectedTeam = useSelectedTeam();

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customImage, setCustomImageState] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(selectedTeam?._id || null);

    const [config, setConfig] = useState<ContainerConfig>({
        name: '',
        memory: DEFAULT_MEMORY,
        cpus: DEFAULT_CPU,
        ports: [],
        env: [],
        mountDockerSocket: false
    });

    useEffect(() => {
        if (selectedTeam && !selectedTeamId) {
            setSelectedTeamId(selectedTeam._id);
        }
    }, [selectedTeam, selectedTeamId]);

    const updateConfig = useCallback(<K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleTemplateSelect = useCallback((templateId: string) => {
        const template = CONTAINER_TEMPLATES.find((containerTemplate) => containerTemplate.id === templateId);
        if (template) {
            let ports: PortMapping[] = [];
            if (template.defaultPort) {
                ports = [{
                    private: template.defaultPort,
                    public: 0
                }];
            }

            let env: EnvVariable[] = [];
            if (template.defaultEnv) {
                env = [...template.defaultEnv];
            }

            setSelectedTemplate(templateId);
            setCustomImageState('');
            setConfig((prev) => ({
                ...prev,
                name: `${template.id}-${Math.floor(Math.random() * 1000)}`,
                ports,
                env,
                mountDockerSocket: template.id === 'coder'
            }));
            goToConfig();
        }
    }, [goToConfig]);

    const setCustomImage = useCallback((image: string, goToConfigFunction: () => void) => {
        if (!image.trim()) {
            sileo.error({ title: 'Please enter a valid image name' });
            return;
        }
        setCustomImageState(image);
        setSelectedTemplate(null);
        setConfig((prev) => ({
            ...prev,
            name: `custom-${Math.floor(Math.random() * 1000)}`
        }));
        goToConfigFunction();
    }, []);

    const getSelectedImage = useCallback(() => {
        if (selectedTemplate) {
            return CONTAINER_TEMPLATES.find((containerTemplate) => containerTemplate.id === selectedTemplate)?.image;
        }
        return customImage || undefined;
    }, [selectedTemplate, customImage]);

    const getSelectedTemplate = useCallback(() => {
        if (selectedTemplate) {
            return CONTAINER_TEMPLATES.find((containerTemplate) => containerTemplate.id === selectedTemplate);
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

        await showPromise(
            createContainerMutation.mutateAsync({
                teamId: selectedTeamId,
                name: config.name,
                image,
                memory: config.memory,
                cpus: config.cpus,
                ports: config.ports.filter((port) => port.private > 0),
                env: config.env.filter((envVariable) => envVariable.key && envVariable.value),
                mountDockerSocket: config.mountDockerSocket,
                useImageCmd: template?.useImageCmd,
                cmd: template?.defaultCmd
            }),
            {
                loading: { title: 'Creating container...' },
                success: { title: 'Container created successfully' },
                error: { title: 'Failed to create container' }
            }
        );
        navigate('/dashboard/containers');
    }, [config, selectedTeamId, getSelectedImage, getSelectedTemplate, createContainerMutation, navigate]);

    return {
        config,
        selectedTemplate,
        customImage,
        selectedTeamId,
        teams,
        isLoading: createContainerMutation.isPending,
        setSelectedTeamId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
        getSelectedImage,
        getSelectedTemplate,
        canProceedToConfig: !!(selectedTemplate || customImage)
    };
};

export default useCreateContainerForm;
