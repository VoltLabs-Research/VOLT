import TemplateCard from '../TemplateCard';
import { CONTAINER_TEMPLATES } from '../../services/container-templates';
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
        <div className='volt-container create-container-step d-flex column gap-2'>
            <div className='volt-container d-flex column gap-05'>
                <h3 className='volt-title font-size-5 font-weight-6'>Choose an image</h3>
                <p className='volt-text font-size-3 color-secondary create-container-step-copy'>Select one starter image or continue with a custom Docker Hub image.</p>
            </div>

            <div className='volt-container create-container-templates-grid gap-1' role='radiogroup' aria-label='Container image templates'>
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
            </div>

            {customImage && (
                <div className='volt-container d-flex column gap-025 p-1 radius-sm create-container-image-preview'>
                    <p className='volt-text font-size-2 color-secondary'>Custom image preview</p>
                    <p className='volt-text font-size-2 color-primary font-weight-5'>{customImage}</p>
                    <p className={`volt-text font-size-2 ${customImageError ? 'color-danger' : 'color-secondary'}`}>
                        {customImageError ?? 'Volt will pull this image directly from the registry when you deploy.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageSelectionStep;
