import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import OptionalConfigSection from './OptionalConfigSection';
import { Stack, Text } from '@voltstack/bravais';
import { getCustomFieldValidationError } from '../../utils/container-form';
import { ContainerTemplateCustomFieldType } from '@/modules/container/contracts/templates';
import type { ContainerTemplateCustomField, ContainerTemplateCustomFieldValues } from '@/modules/container/contracts/templates';

interface TemplateCustomFieldsSectionProps {
    customFields: ContainerTemplateCustomField[];
    customFieldValues: ContainerTemplateCustomFieldValues;
    errorCount: number;
    onChange: (customFieldValues: ContainerTemplateCustomFieldValues) => void;
}

/** The template-provided extra inputs (passwords, tokens, ...) of a container image. */
const TemplateCustomFieldsSection = ({
    customFields,
    customFieldValues,
    errorCount,
    onChange
}: TemplateCustomFieldsSectionProps) => (
    <OptionalConfigSection
        title='Template settings'
        description='These options come from the selected template.'
        defaultExpanded={customFields.some((customField) => customField.required)}
        errorCount={errorCount}
    >
        <Stack gap='1'>
            {customFields.map((customField) => {
                const isPassword = customField.type === ContainerTemplateCustomFieldType.Password;
                const fieldValue = customFieldValues[customField.id] ?? '';

                return (
                    <Stack key={customField.id} gap='05'>
                        <FormFieldRHF
                            label={customField.required ? `${customField.label} (required)` : customField.label}
                            name={customField.id}
                            placeholder={customField.placeholder}
                            value={fieldValue}
                            onChange={(event) => onChange({
                                ...customFieldValues,
                                [customField.id]: event.target.value
                            })}
                            type={isPassword ? 'password' : 'text'}
                            error={getCustomFieldValidationError(customField, fieldValue) ?? undefined}
                            inputProps={{ autoComplete: isPassword ? 'new-password' : 'off' }}
                            className='w-full'
                        />
                        {customField.description && (
                            <Text as='p' size='md' tone='muted'>{customField.description}</Text>
                        )}
                    </Stack>
                );
            })}
        </Stack>
    </OptionalConfigSection>
);

export default TemplateCustomFieldsSection;
