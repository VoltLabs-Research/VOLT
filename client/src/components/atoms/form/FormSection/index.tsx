import FormField from '@/components/molecules/form/FormField';
import Container from '@/components/primitives/Container';

const FormSection = ({
    title,
    enabled,
    onToggle,
    children
}) => {
    return (
        <Container>
            <Container className='d-flex column gap-1'>
                <FormField
                    fieldValue={enabled}
                    fieldKey='enabled'
                    fieldType='checkbox'
                    label={title}
                    onFieldChange={(_, next) => onToggle(next)}
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
