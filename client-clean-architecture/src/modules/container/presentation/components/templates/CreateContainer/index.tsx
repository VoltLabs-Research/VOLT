import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import useCreateContainerForm from '../../../hooks/use-create-container-form';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Stepper, { type StepIndicator } from '@/shared/presentation/components/Stepper';
import Modal, { openModal, closeModal } from '@/shared/presentation/components/Modal';
import { ImageSelectionStep, ConfigurationStep, ReviewStep } from '../../organisms/CreateContainerSteps';
import './CreateContainer.css';

type StepKey = 'image' | 'config' | 'review';

const STEP_ORDER: StepKey[] = ['image', 'config', 'review'];

const STEP_INDICATORS: StepIndicator<StepKey>[] = [
    { key: 'image', label: 'Image', description: 'Select template' },
    { key: 'config', label: 'Configuration', description: 'Resources & Network' },
    { key: 'review', label: 'Review', description: 'Deploy container' }
];

const CreateContainer = () => {
    const navigate = useNavigate();
    const { step, goTo } = useStepper<StepKey>('image', { steps: STEP_ORDER });
    const [tempCustomImage, setTempCustomImage] = useState('');

    const {
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
        canProceedToConfig
    } = useCreateContainerForm(() => goTo('config'));

    const confirmCustomImage = () => {
        setCustomImage(tempCustomImage, () => goTo('config'));
        closeModal('custom-image-modal');
    };

    const canNavigateTo = (key: StepKey): boolean => {
        if(key === 'image') return true;
        if(key === 'config') return canProceedToConfig;
        if(key === 'review') return canProceedToConfig;
        return false;
    };

    const steps = [
        {
            key: 'image' as const,
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
            key: 'config' as const,
            content: (
                <ConfigurationStep
                    config={config}
                    teams={teams}
                    selectedTeamId={selectedTeamId}
                    onConfigChange={updateConfig}
                    onTeamChange={setSelectedTeamId}
                    onBack={() => goTo('image')}
                    onNext={() => goTo('review')}
                />
            )
        },
        {
            key: 'review' as const,
            content: (
                <ReviewStep
                    config={config}
                    teams={teams}
                    selectedTeamId={selectedTeamId}
                    image={getSelectedImage()}
                    isLoading={isLoading}
                    onBack={() => goTo('config')}
                    onCreate={handleCreate}
                />
            )
        }
    ];

    return (
        <Container className='d-flex column create-container-page h-max overflow-hidden'>
            <Container className='d-flex items-center gap-1-5 create-container-header p-1-5 f-shrink-0'>
                <Button variant='ghost' intent='neutral' iconOnly onClick={() => navigate('/dashboard/containers')}>
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
                <FormField
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
