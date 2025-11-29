import FormField from '@/components/molecules/form/FormField';
import './FormSection.css';

const FormSection = ({
    title,
    enabled,
    onToggle,
    children
}) => {
    return (
        <div className='form-control-section'>
            <div className='form-control-top-container'>
                <FormField
                    fieldValue={enabled}
                    fieldKey='enabled'
                    fieldType='checkbox'
                    label={title}
                    onFieldChange={(_, next) => onToggle(next)}
                />

                {enabled && (
                    <div className='form-control-group'>
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FormSection;