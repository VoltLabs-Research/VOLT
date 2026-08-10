import { cn } from '@heroui/react';
import TemplateCard from '../TemplateCard';
import { CONTAINER_TEMPLATES } from '../../services/container-templates';
import { Server } from 'lucide-react';

interface ImageSelectionStepProps {
    selectedTemplate: string | null;
    customImage: string;
    customImageError?: string | null;
    onTemplateSelect: (templateId: string) => void;
    onCustomImageClick: () => void;
}

const ImageSelectionStep = ({
    selectedTemplate,
    customImage,
    customImageError,
    onTemplateSelect,
    onCustomImageClick
}: ImageSelectionStepProps) => {
    const customImageDescription = customImage || 'Pull any image from Docker Hub.';

    return (
        <div className='flex flex-col gap-8 create-container-step'>
            <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-semibold text-foreground'>Choose an image</h3>
                <p className='text-base text-muted create-container-step-copy'>Select one starter image or continue with a custom Docker Hub image.</p>
            </div>

            <div className='create-container-templates-grid gap-4' role='radiogroup' aria-label='Container image templates'>
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
                    icon={<Server size={32} className='text-muted' />}
                    isSelected={!selectedTemplate && !!customImage}
                    onClick={onCustomImageClick}
                    variant='custom'
                />
            </div>

            {customImage && (
                <div className='flex flex-col gap-1 p-4 rounded-lg create-container-image-preview'>
                    <p className='text-sm text-muted'>Custom image preview</p>
                    <p className='text-sm font-medium text-foreground'>{customImage}</p>
                    <p className={cn('text-sm', customImageError ? 'text-danger' : 'text-muted')}>
                        {customImageError ?? 'Volt will pull this image directly from the registry when you deploy.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageSelectionStep;
