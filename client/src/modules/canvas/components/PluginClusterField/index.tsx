import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import type { SelectOption } from '@/shared/presentation/primitives';

interface PluginClusterFieldProps {
    fieldKey: string;
    fieldValue: string;
    options: SelectOption[];
    onFieldChange: (key: string, value: string | number | boolean) => void;
};

const PluginClusterField = ({ fieldKey, fieldValue, options, onFieldChange }: PluginClusterFieldProps) => {
    return (
        <FormFieldRHF
            label='Cluster'
            fieldType='select'
            variant='canvas'
            fieldKey={fieldKey}
            fieldValue={fieldValue}
            options={options}
            onFieldChange={onFieldChange}
        />
    );
};

export default PluginClusterField;
