import useCreateContainerForm from '../../../hooks/use-create-container-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import Modal from '@/shared/presentation/components/Modal';
import Stepper from '@/shared/presentation/components/Stepper';
import type { StepIndicator } from '@/shared/presentation/components/Stepper';
import { ImageSelectionStep, ConfigurationStep, ReviewStep } from '../../organisms/CreateContainerSteps';
import './CreateContainer.css';

enum StepKey {
    Image = 'image',
    Config = 'config',
    Review = 'review'
};

const STEP_ORDER: StepKey[] = [StepKey.Image, StepKey.Config, StepKey.Review];

const STEP_INDICATORS: StepIndicator<StepKey>[] = [
    {
        key: StepKey.Image,
        label: 'Image',
        description: 'Select template'
    },
    {
        key: StepKey.Config,
        label: 'Configuration',
        description: 'Resources & Network'
    },
    {
        key: StepKey.Review,
        label: 'Review',
        description: 'Deploy container'
    }
];

const CreateContainer = () => {
    const navigate = useNavigate();
    const { step, goTo } = useStepper<StepKey>(StepKey.Image, { steps: STEP_ORDER });
    const [tempCustomImage, setTempCustomImage] = useState('');

    const {
        config,
        selectedTemplate,
        customImage,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        isLoading,
        setSelectedTeamId,
        setSelectedTeamClusterId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
        getSelectedImage,
        canProceedToConfig
    } = useCreateContainerForm(() => goTo(StepKey.Config));

    const confirmCustomImage = () => {
        setCustomImage(tempCustomImage, () => goTo(StepKey.Config));
        closeModal('custom-image-modal');
    };

    const canNavigateTo = (key: StepKey): boolean => {
        if(key === StepKey.Image) return true;
        if(key === StepKey.Config) return canProceedToConfig;
        if(key === StepKey.Review) return canProceedToConfig;
        return false;
    };

    const steps = [
        {
            key: StepKey.Image,
            content: (
                <ImageSelectionStep
                    selectedTemplate={selectedTemplate}
                    customImage={customImage}
                    onTemplateSelect={handleTemplateSelect}
                    onCustomImageClick={() => {
                        setTempCustomImage(customImage);
                        openModal('custom-image-modal');
                    }}
                />
            )
        },
        {
            key: StepKey.Config,
            content: (
                <ConfigurationStep
                    config={config}
                    teams={teams}
                    teamClusters={teamClusters}
                    selectedTeamId={selectedTeamId}
                    selectedTeamClusterId={selectedTeamClusterId}
                    onConfigChange={updateConfig}
                    onTeamChange={setSelectedTeamId}
                    onTeamClusterChange={setSelectedTeamClusterId}
                    onBack={() => goTo(StepKey.Image)}
                    onNext={() => goTo(StepKey.Review)}
                />
            )
        },
        {
            key: StepKey.Review,
            content: (
                <ReviewStep
                    config={config}
                    teams={teams}
                    teamClusters={teamClusters}
                    selectedTeamId={selectedTeamId}
                    selectedTeamClusterId={selectedTeamClusterId}
                    image={getSelectedImage()}
                    isLoading={isLoading}
                    onBack={() => goTo(StepKey.Config)}
                    onCreate={handleCreate}
                />
            )
        }
    ];

    return (
        <Container className='d-flex column create-container-page h-max overflow-hidden'>
            <Container className='d-flex items-center gap-1-5 create-container-header p-1-5 f-shrink-0'>
                <Button variant='ghost' intent='neutral' iconOnly aria-label='Back to containers' title='Back to containers' onClick={() => navigate('/dashboard/containers')}>
                    <ArrowLeft size={20} />
                </Button>
                <Container className='d-flex column gap-02'>
                    <Title className='font-size-5 font-weight-6'>Create New Container</Title>
                    <Paragraph className='color-muted'>Deploy a new containerized application in seconds.</Paragraph>
                </Container>
            </Container>

            <Stepper
                steps={steps}
                activeStep={step}
                indicators={STEP_INDICATORS}
                onStepClick={goTo}
                canNavigateTo={canNavigateTo}
            />

            <Modal
                id='custom-image-modal'
                title='Custom Docker Image'
                description='Enter the name of the Docker image you want to pull from Docker Hub.'
                width='420px'
                footer={
                    <>
                        <Button variant='outline' intent='neutral' onClick={() => closeModal('custom-image-modal')}>Cancel</Button>
                        <Button variant='solid' intent='brand' onClick={confirmCustomImage}>Confirm</Button>
                    </>
                }
            >
                <FormFieldRHF
                    placeholder='e.g., nginx:latest, mysql:8.0'
                    value={tempCustomImage}
                    onChange={(e) => setTempCustomImage(e.target.value)}
                    autoFocus
                />
            </Modal>
        </Container>
    );
};

export default CreateContainer;
