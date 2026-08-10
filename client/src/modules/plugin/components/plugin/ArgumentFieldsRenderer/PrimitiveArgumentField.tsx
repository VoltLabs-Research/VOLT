import { ArgumentType } from '@volt/contracts/modules/plugin/enums';
import {
    coerceArgumentInputValue,
    getArgumentDefaultValue,
    getPrimitiveArgumentFieldValue
} from '@/modules/plugin/utils/plugin/argument-values';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { SelectOption } from '@voltstack/bravais';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

interface PrimitiveArgumentFieldProps {
    argument: IArgumentDefinition;
    value: unknown;
    fieldKey: string;
    frameOptions: SelectOption[];
    selectOptions: SelectOption[];
    autocompleteOptions?: FormFieldAutocompleteOption[];
    allowTemplateReferenceMode: boolean;
    onChange: (key: string, value: unknown) => void;
}

interface PrimitiveFieldConfig {
    fieldType: 'input' | 'select' | 'checkbox';
    options?: SelectOption[];
    inputProps?: {
        type: 'number';
        step?: number;
        min?: number;
        max?: number;
    };
}

const getPrimitiveFieldConfig = (
    argument: IArgumentDefinition,
    frameOptions: SelectOption[],
    selectOptions: SelectOption[]
): PrimitiveFieldConfig => {
    if (argument.type === ArgumentType.BOOLEAN) {
        return {
            fieldType: 'checkbox'
        };
    }

    if (argument.type === ArgumentType.SELECT) {
        return {
            fieldType: 'select',
            options: selectOptions
        };
    }

    if (argument.type === ArgumentType.FRAME) {
        return {
            fieldType: 'select',
            options: frameOptions
        };
    }

    if (argument.type === ArgumentType.NUMBER) {
        return {
            fieldType: 'input',
            inputProps: {
                type: 'number',
                step: argument.step,
                min: argument.min,
                max: argument.max
            }
        };
    }

    return {
        fieldType: 'input'
    };
};

const PrimitiveArgumentField = ({
    argument,
    value,
    fieldKey,
    frameOptions,
    selectOptions,
    autocompleteOptions,
    allowTemplateReferenceMode,
    onChange
}: PrimitiveArgumentFieldProps) => {
    const isTemplateReferenceMode = allowTemplateReferenceMode
        && typeof value === 'string'
        && value.includes('{{');
    const fieldConfig = getPrimitiveFieldConfig(argument, frameOptions, selectOptions);

    return (
        <div className='flex flex-col gap-2'>
            {allowTemplateReferenceMode && (
                <FormFieldRHF
                    label='Use reference'
                    fieldKey={`${fieldKey}-reference-mode`}
                    fieldType='checkbox'
                    fieldValue={isTemplateReferenceMode}
                    onFieldChange={(_, nextValue) => {
                        onChange(argument.argument, nextValue
                            ? (typeof value === 'string' ? value : '')
                            : getArgumentDefaultValue(argument));
                    }}
                    variant='canvas'
                />
            )}
            <FormFieldRHF
                label={argument.label || argument.argument}
                fieldKey={fieldKey}
                fieldType={isTemplateReferenceMode ? 'input' : fieldConfig.fieldType}
                fieldValue={isTemplateReferenceMode
                    ? String(value ?? '')
                    : getPrimitiveArgumentFieldValue(argument, value)}
                options={isTemplateReferenceMode ? undefined : fieldConfig.options}
                inputProps={isTemplateReferenceMode ? undefined : fieldConfig.inputProps}
                onFieldChange={(_, nextValue) => onChange(argument.argument, coerceArgumentInputValue(argument, nextValue))}
                variant='canvas'
                autocomplete={autocompleteOptions?.length ? { options: autocompleteOptions } : undefined}
                placeholder={isTemplateReferenceMode ? '{{ arguments.some-value }}' : undefined}
            />
        </div>
    );
};

export default PrimitiveArgumentField;
