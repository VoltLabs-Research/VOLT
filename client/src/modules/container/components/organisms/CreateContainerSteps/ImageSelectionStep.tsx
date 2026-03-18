import TemplateCard from '../../atoms/TemplateCard';
import { CONTAINER_TEMPLATES } from '../../../services/container-templates';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { Server } from 'lucide-react';

interface ImageSelectionStepProps {
    selectedTemplate: string | null;
    customImage: string;
    customImageError?: string | null;
    onTemplateSelect: (templateId: string) => void;
    onCustomImageClick: () => void;
};

const ImageSelectionStep = ({
    selectedTemplate,
    customImage,
    customImageError,
    onTemplateSelect,
    onCustomImageClick
}: ImageSelectionStepProps) => {
    const customImageDescription = customImage || 'Pull any image from Docker Hub.';

    return (
        <Container className='create-container-step d-flex column gap-2'>
            <Container className='d-flex column gap-05'>
                <Title className='font-size-5 font-weight-6'>Choose an image</Title>
                <Paragraph className='font-size-3 color-secondary create-container-step-copy'>Select one starter image or continue with a custom Docker Hub image.</Paragraph>
            </Container>

            <Container className='create-container-templates-grid gap-1' role='radiogroup' aria-label='Container image templates'>
                {CONTAINER_TEMPLATES.map((template) => (
                    <TemplateCard
                        key={template.id}
                        name={template.name}
                        description={template.description}
                        icon={<img src={template.logo} alt='' className='create-container-template-logo' />}
                        isSelected={selectedTemplate === template.id}
                        onClick={() => onTemplateSelect(template.id)}
                    />
                ))}
                <TemplateCard
                    name='Custom Image'
                    description={customImageDescription}
                    icon={<Server size={32} className='color-muted' />}
                    isSelected={!selectedTemplate && !!customImage}
                    onClick={onCustomImageClick}
                    variant='custom'
                />
            </Container>

            {customImage && (
                <Container className='d-flex column gap-025 p-1 radius-sm create-container-step-gate'>
                    <Paragraph className='font-size-2 color-secondary'>Custom image preview</Paragraph>
                    <Paragraph className='font-size-2 font-family-mono color-primary'>{customImage}</Paragraph>
                    <Paragraph className={`font-size-2 ${customImageError ? 'color-danger' : 'color-secondary'}`}>
                        {customImageError ?? 'Volt will pull this image directly from the registry when you deploy.'}
                    </Paragraph>
                </Container>
            )}
        </Container>
    );
};

export default ImageSelectionStep;
