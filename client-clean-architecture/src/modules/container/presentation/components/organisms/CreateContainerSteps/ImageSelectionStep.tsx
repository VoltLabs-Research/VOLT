import { Server } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import TemplateCard from '../../atoms/TemplateCard';
import { CONTAINER_TEMPLATES } from '../../../data/container-templates';

interface ImageSelectionStepProps {
    selectedTemplate: string | null;
    customImage: string;
    onTemplateSelect: (templateId: string) => void;
    onCustomImageClick: () => void;
};

const ImageSelectionStep = ({ 
    selectedTemplate, 
    customImage,
    onTemplateSelect,
    onCustomImageClick
}: ImageSelectionStepProps) => (
    <Container className='create-container-step d-flex column gap-2'>
        <Title className='font-size-5 font-weight-6'>Select a Template</Title>
        <Container className='create-container-templates-grid gap-1'>
            {CONTAINER_TEMPLATES.map((template) => (
                <TemplateCard
                    key={template.id}
                    name={template.name}
                    description={template.description}
                    icon={<img src={template.logo} alt={template.name} className='create-container-template-logo' />}
                    isSelected={selectedTemplate === template.id}
                    onClick={() => onTemplateSelect(template.id)}
                />
            ))}
            <TemplateCard
                name='Custom Image'
                description='Pull any image from Docker Hub.'
                icon={<Server size={32} className='color-muted' />}
                isSelected={!selectedTemplate && !!customImage}
                onClick={onCustomImageClick}
                variant='custom'
            />
        </Container>
    </Container>
);

export default ImageSelectionStep;
