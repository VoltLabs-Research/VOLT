import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useContainerUseCases from './use-container-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useToast from '@/shared/presentation/hooks/use-toast';
import { CONTAINER_TEMPLATES, type ContainerTemplate } from '../data/container-templates';

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 512;

export interface PortMapping{
    private: number;
    public: number;
}

export interface EnvVariable{
    key: string;
    value: string;
}

export interface ContainerConfig{
    name: string;
    memory: number;
    cpus: number;
    ports: PortMapping[];
    env: EnvVariable[];
    mountDockerSocket: boolean;
}

export interface UseCreateContainerFormReturn{
    config: ContainerConfig;
    selectedTemplate: string | null;
    customImage: string;
    selectedTeamId: string | null;
    teams: ReturnType<typeof useTeamStore.getState>['teams'];
    isLoading: boolean;
    setSelectedTeamId: (id: string | null) => void;
    updateConfig: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    handleTemplateSelect: (templateId: string) => void;
    setCustomImage: (image: string, goToConfig: () => void) => void;
    handleCreate: () => Promise<void>;
    getSelectedImage: () => string | undefined;
    getSelectedTemplate: () => ContainerTemplate | undefined;
    canProceedToConfig: boolean;
}

const useCreateContainerForm = (goToConfig: () => void): UseCreateContainerFormReturn => {
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();
    const { containerRepository } = useContainerUseCases();
    
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    const [isLoading, setIsLoading] = useState(false);
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
        if(selectedTeam && !selectedTeamId){
            setSelectedTeamId(selectedTeam._id);
        }
    }, [selectedTeam, selectedTeamId]);

    const updateConfig = useCallback(<K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleTemplateSelect = useCallback((templateId: string) => {
        const template = CONTAINER_TEMPLATES.find((t) => t.id === templateId);
        if(template){
            setSelectedTemplate(templateId);
            setCustomImageState('');
            setConfig((prev) => ({
                ...prev,
                name: `${template.id}-${Math.floor(Math.random() * 1000)}`,
                ports: template.defaultPort ? [{ private: template.defaultPort, public: 0 }] : [],
                env: template.defaultEnv ? [...template.defaultEnv] : [],
                mountDockerSocket: template.id === 'coder'
            }));
            goToConfig();
        }
    }, [goToConfig]);

    const setCustomImage = useCallback((image: string, goToConfigFn: () => void) => {
        if(!image.trim()){
            showError('Please enter a valid image name');
            return;
        }
        setCustomImageState(image);
        setSelectedTemplate(null);
        setConfig((prev) => ({
            ...prev,
            name: `custom-${Math.floor(Math.random() * 1000)}`
        }));
        goToConfigFn();
    }, [showError]);

    const getSelectedImage = useCallback(() => {
        return selectedTemplate
            ? CONTAINER_TEMPLATES.find((t) => t.id === selectedTemplate)?.image
            : customImage || undefined;
    }, [selectedTemplate, customImage]);

    const getSelectedTemplate = useCallback(() => {
        return selectedTemplate ? CONTAINER_TEMPLATES.find((t) => t.id === selectedTemplate) : undefined;
    }, [selectedTemplate]);

    const handleCreate = useCallback(async () => {
        const image = getSelectedImage();
        const template = getSelectedTemplate();

        if(!image){
            showError('Please select a template or specify an image');
            return;
        }

        if(!config.name){
            showError('Please give your container a name');
            return;
        }

        if(!selectedTeamId){
            showError('Please select a team for this container');
            return;
        }

        setIsLoading(true);
        try{
            await containerRepository.create({
                name: config.name,
                image,
                memory: config.memory,
                cpus: config.cpus,
                ports: config.ports.filter((p) => p.private > 0),
                env: config.env.filter((e) => e.key && e.value),
                mountDockerSocket: config.mountDockerSocket,
                useImageCmd: template?.useImageCmd,
                cmd: template?.defaultCmd
            });

            showSuccess('Container created successfully');
            navigate('/dashboard/containers');
        }catch(error: any){
            showError(error?.response?.data?.message || 'Failed to create container');
        }finally{
            setIsLoading(false);
        }
    }, [config, selectedTeamId, getSelectedImage, getSelectedTemplate, containerRepository, showSuccess, showError, navigate]);

    return {
        config,
        selectedTemplate,
        customImage,
        selectedTeamId,
        teams,
        isLoading,
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
