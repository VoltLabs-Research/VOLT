import type { ReactNode } from 'react';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import Container from '@/shared/presentation/components/primitives/Container';

interface FormSectionProps {
    title: string;
    enabled: boolean;
    onToggle?: (enabled: boolean) => void;
    children?: ReactNode;
}

const FormSection = ({
    title,
    enabled,
    onToggle = () => {},
    children
}: FormSectionProps) => {
    return (
        <Container>
            <Container className='d-flex column gap-1'>
                <FormField
                    fieldValue={enabled}
                    fieldKey='enabled'
                    fieldType='checkbox'
                    label={title}
                    onFieldChange={(_: unknown, next: boolean) => onToggle(next)}
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
