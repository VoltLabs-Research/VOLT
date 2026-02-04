import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';

interface FormSectionProps {
    title: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    children: React.ReactNode;
}

const FormSection = ({ title, enabled, onToggle, children }: FormSectionProps) => {
    return (
        <Container>
            <Container className='d-flex column gap-1'>
                <FormField
                    fieldValue={enabled}
                    fieldKey='enabled'
                    fieldType='checkbox'
                    label={title}
                    onFieldChange={(_, next) => onToggle(Boolean(next))}
                />

                {enabled && (
                    <Container className='d-flex column gap-2'>
                        {children}
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default FormSection;
