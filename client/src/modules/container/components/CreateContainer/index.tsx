import useCreateContainerForm from './use-create-container-form';
import { getCustomImageValidationError } from '../../utils/container-form';
import ImageSelectionStep from '../CreateContainerSteps/ImageSelectionStep';
import ConfigurationStep from '../CreateContainerSteps/ConfigurationStep';
import ReviewStep from '../CreateContainerSteps/ReviewStep';
import CreateContainerStepper from '../CreateContainerStepper';
import type { StepperIndicator } from '../CreateContainerStepper';
import { useStepper } from '@/shared/ui/hooks/use-stepper';
import useTip from '@/shared/tips/use-tip';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';
import { Button, Tooltip } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

enum StepKey {
    Image = 'image',
    Config = 'config',
    Review = 'review'
}

const STEP_ORDER: StepKey[] = [StepKey.Image, StepKey.Config, StepKey.Review];

const STEP_INDICATORS: StepperIndicator<StepKey>[] = [
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
        selectedTemplateEntity,
        customImage,
        customImageError,
        image,
        selectedTeamId,
        selectedTeamClusterId,
        teams,
        teamClusters,
        clusterResourceLimits,
        isLoadingResourceLimits,
        isLoading,
        deployProgressMessage,
        deployProgressRate,
        deployStartedAt,
        draftLastSavedAt,
        setSelectedTeamId,
        setSelectedTeamClusterId,
        updateConfig,
        handleTemplateSelect,
        setCustomImage,
        handleCreate,
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
                    image={image}
                    selectedTemplateName={selectedTemplateEntity?.name}
                    draftLastSavedAt={draftLastSavedAt}
                    isLoading={isLoading}
                    deployProgressMessage={deployProgressMessage}
                    deployProgressRate={deployProgressRate}
                    deployStartedAt={deployStartedAt}
                    onBack={() => goTo(StepKey.Config)}
                    onCreate={handleCreate}
                />
            )
        }
    ];

    return (
        <div className='flex flex-col overflow-hidden h-full'>
            <div className='flex flex-row items-center gap-6 p-6 shrink-0'>
                <Tooltip>
                    <Button variant='ghost' isIconOnly aria-label='Back to containers' onPress={() => navigate('/dashboard/containers')}>
                        <ArrowLeft size={20} />
                    </Button>
                    <Tooltip.Content placement='bottom'>Back to containers</Tooltip.Content>
                </Tooltip>
                <div className='flex flex-col gap-1'>
                    <h3 className='text-xl font-semibold text-foreground'>Create New Container</h3>
                </div>
            </div>
            <CreateContainerStepper
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
                    <ModalFooterActions
                        secondary={{
                            label: 'Cancel',
                            variant: 'outline',
                            onPress: () => closeModal(CUSTOM_IMAGE_MODAL_ID)
                        }}
                        primary={{
                            label: 'Save image and continue',
                            onPress: confirmCustomImage,
                            isDisabled: !trimmedCustomImage || !!tempCustomImageError
                        }}
                    />
                }
            >
                <div className='flex flex-col gap-3'>
                    <FormFieldRHF
                        label='Docker image'
                        placeholder='e.g., nginx:latest, mysql:8.0'
                        value={tempCustomImage}
                        onChange={(e) => setTempCustomImage(e.target.value)}
                        error={tempCustomImageError ?? undefined}
                        autoFocus
                    />
                    <p className='text-sm text-muted'>Use a full Docker image reference. Tags are recommended so deployments stay predictable.</p>
                </div>
            </Modal>
        </div>
    );
};

export default CreateContainer;
