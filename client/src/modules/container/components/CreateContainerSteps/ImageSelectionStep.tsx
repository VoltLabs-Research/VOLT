import TemplateCard from '../TemplateCard';
import { CONTAINER_TEMPLATES } from '../../services/container-templates';
import { Server } from 'lucide-react';
import { Box, Heading, Stack, Text } from '@voltstack/bravais';

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
        <Stack className='create-container-step' gap='2'>
            <Stack gap='05'>
                <Heading level={3} size='xl' weight='bold'>Choose an image</Heading>
                <Text as='p' size='lg' tone='secondary' className='create-container-step-copy'>Select one starter image or continue with a custom Docker Hub image.</Text>
            </Stack>

            <Box className='create-container-templates-grid gap-1' role='radiogroup' aria-label='Container image templates'>
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
            </Box>

            {customImage && (
                <Stack className='create-container-image-preview' gap='025' p='1' radius='sm'>
                    <Text as='p' size='md' tone='secondary'>Custom image preview</Text>
                    <Text as='p' size='md' tone='primary' weight='medium'>{customImage}</Text>
                    <Text as='p' size='md' className={customImageError ? 'color-danger' : 'color-secondary'}>
                        {customImageError ?? 'Volt will pull this image directly from the registry when you deploy.'}
                    </Text>
                </Stack>
            )}
        </Stack>
    );
};

export default ImageSelectionStep;
