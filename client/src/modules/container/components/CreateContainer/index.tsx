import useCreateContainerForm, { getCustomImageValidationError } from '../../hooks/use-create-container-form';
import { ImageSelectionStep, ConfigurationStep, ReviewStep } from '../CreateContainerSteps';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import useTip from '@/shared/tips/use-tip';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Modal, { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Stepper from '@/shared/presentation/primitives/Stepper';
import Text from '@/shared/presentation/primitives/Text';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import type { StepIndicator } from '@/shared/presentation/primitives/Stepper';
import './CreateContainer.css';
import { useNavigate } from 'react-router-dom';
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
        customImageError,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading,
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
        canProceedToConfig,
        canProceedToReview
    } = useCreateContainerForm();

    const trimmedCustomImage = tempCustomImage.trim();
    const tempCustomImageError = trimmedCustomImage ? getCustomImageValidationError(trimmedCustomImage) : null;

    const confirmCustomImage = () => {
        if (!trimmedCustomImage || tempCustomImageError) {
            return;
        }

        setCustomImage(trimmedCustomImage);
        closeModal(CUSTOM_IMAGE_MODAL_ID);
        goTo(StepKey.Config);
    };

    const canNavigateTo = (key: StepKey): boolean => {
        if(key === StepKey.Image) return true;
        if(key === StepKey.Config) return canProceedToConfig;
        if(key === StepKey.Review) return canProceedToReview;
        return false;
    };

    const steps = [
        {
            key: StepKey.Image,
            content: (
                <ImageSelectionStep
                    selectedTemplate={selectedTemplate}
                    customImage={customImage}
                    customImageError={customImageError}
                    onTemplateSelect={(templateId) => {
                        handleTemplateSelect(templateId);
                        goTo(StepKey.Config);
                    }}
                    onCustomImageClick={() => {
                            setTempCustomImage(customImage);
                            openModal(CUSTOM_IMAGE_MODAL_ID);
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
                    selectedTemplateName={getSelectedTemplate()?.name}
                    draftLastSavedAt={draftLastSavedAt}
                    isLoading={isLoading}
                    deployProgressMessage={deployProgressMessage}
                    onBack={() => goTo(StepKey.Config)}
                    onCreate={handleCreate}
                />
            )
        }
    ];

    return (
        <Stack className='create-container-page' height='max' overflow='hidden'>
            <Row className='create-container-header' gap='1-5' p='1-5' shrink='0'>
                <Button variant='ghost' intent='neutral' iconOnly aria-label='Back to containers' title='Back to containers' onClick={() => navigate('/dashboard/containers')}>
                    <ArrowLeft size={20} />
                </Button>
                <Stack className='gap-02'>
                    <Heading level={3} size='xl' weight='bold'>Create New Container</Heading>
                </Stack>
            </Row>

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
                        <Button variant='solid' intent='brand' onClick={confirmCustomImage} disabled={!trimmedCustomImage || !!tempCustomImageError}>Save image and continue</Button>
                    </>
                }
            >
                <Stack gap='075' p='1-5'>
                    <FormFieldRHF
                        label='Docker image'
                        placeholder='e.g., nginx:latest, mysql:8.0'
                        value={tempCustomImage}
                        onChange={(e) => setTempCustomImage(e.target.value)}
                        error={tempCustomImageError ?? undefined}
                        autoFocus
                    />
                    <Text as='p' size='md' tone='secondary'>Use a full Docker image reference. Tags are recommended so deployments stay predictable.</Text>
                </Stack>
            </Modal>
        </Stack>
    );
};

export default CreateContainer;
