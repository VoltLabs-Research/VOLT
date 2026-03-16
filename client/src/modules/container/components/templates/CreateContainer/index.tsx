import useCreateContainerForm from '../../../hooks/use-create-container-form';
import { ImageSelectionStep, ConfigurationStep, ReviewStep } from '../../organisms/CreateContainerSteps';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import useTip from '@/shared/tips/use-tip';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal from '@/shared/presentation/components/Modal';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Stepper from '@/shared/presentation/components/Stepper';
import Title from '@/shared/presentation/components/Title';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StepIndicator } from '@/shared/presentation/components/Stepper';
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
        description: 'Choose one'
    },
    {
        key: StepKey.Config,
        label: 'Configuration',
        description: 'Set details'
    },
    {
        key: StepKey.Review,
        label: 'Review',
        description: 'Confirm'
    }
];

const CUSTOM_IMAGE_MODAL_ID = 'custom-image-modal';

const CreateContainer = () => {
    useTip('container-create-stepper');

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
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading,
        deployProgressMessage,
        setSelectedTeamId,
        setSelectedTeamClusterId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
        getSelectedImage,
        canProceedToConfig,
        canProceedToReview
    } = useCreateContainerForm();

    const trimmedCustomImage = tempCustomImage.trim();

    const confirmCustomImage = () => {
        if (!trimmedCustomImage) {
            return;
        }

        setCustomImage(trimmedCustomImage, () => goTo(StepKey.Config));
        closeModal(CUSTOM_IMAGE_MODAL_ID);
    };

    const canNavigateTo = (key: StepKey): boolean => {
        if(key === StepKey.Image) return true;
        if(key === StepKey.Config) return canProceedToConfig;
        if(key === StepKey.Review) return canProceedToReview;
        return false;
    };

    const handleImageStepContinue = () => {
        if (!canProceedToConfig) {
            return;
        }

        goTo(StepKey.Config);
    };

    const steps = [
        {
            key: StepKey.Image,
            content: (
                <Container className='d-flex column gap-2'>
                    <ImageSelectionStep
                        selectedTemplate={selectedTemplate}
                        customImage={customImage}
                        onTemplateSelect={handleTemplateSelect}
                        onCustomImageClick={() => {
                            setTempCustomImage(customImage);
                            openModal(CUSTOM_IMAGE_MODAL_ID);
                        }}
                    />

                    <Container className='create-container-step-gate d-flex items-center content-between gap-1 p-1 radius-sm'>
                        <Paragraph className='font-size-2 color-secondary'>
                            {canProceedToConfig
                                ? 'Image selected. Continue when you are ready to configure the deployment.'
                                : 'Select one template or confirm a custom image before continuing.'}
                        </Paragraph>
                        <Button variant='solid' intent='brand' onClick={handleImageStepContinue} disabled={!canProceedToConfig}>Continue to configuration</Button>
                    </Container>
                </Container>
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
                    clusterResourceLimits={clusterResourceLimits}
                    isLoadingResourceLimits={isLoadingResourceLimits}
                    canProceed={canProceedToReview}
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
                    deployProgressMessage={deployProgressMessage}
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
                id={CUSTOM_IMAGE_MODAL_ID}
                title='Use a custom image'
                description='Paste a Docker Hub image reference, then confirm it before continuing.'
                width='420px'
                footer={
                    <>
                        <Button variant='outline' intent='neutral' onClick={() => closeModal(CUSTOM_IMAGE_MODAL_ID)}>Cancel</Button>
                        <Button variant='solid' intent='brand' onClick={confirmCustomImage} disabled={!trimmedCustomImage}>Save image and continue</Button>
                    </>
                }
            >
                <Container className='d-flex column gap-075 p-1-5'>
                    <FormFieldRHF
                        label='Docker image'
                        placeholder='e.g., nginx:latest, mysql:8.0'
                        value={tempCustomImage}
                        onChange={(e) => setTempCustomImage(e.target.value)}
                        autoFocus
                    />
                    <Paragraph className='font-size-2 color-secondary'>A non-empty image reference is required before you can continue.</Paragraph>
                </Container>
            </Modal>
        </Container>
    );
};

export default CreateContainer;
