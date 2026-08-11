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
        <div className='flex flex-col gap-8'>
            <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-semibold text-foreground'>Choose an image</h3>
                <p className='max-w-[46rem] text-base text-muted'>Select one starter image or continue with a custom Docker Hub image.</p>
            </div>
            <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 max-[768px]:grid-cols-1' role='radiogroup' aria-label='Container image templates'>
                {CONTAINER_TEMPLATES.map((template) => (
                    <TemplateCard
                        key={template.id}
                        name={template.name}
                        description={template.description}
                        icon={<img src={template.logo} alt='' className='size-9 object-contain' />}
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
                <div className='flex flex-col gap-1 rounded-lg border border-border bg-[color-mix(in_srgb,var(--surface-tertiary)_70%,transparent)] p-4'>
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
