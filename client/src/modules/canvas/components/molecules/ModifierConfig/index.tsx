import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';

import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { ReactNode } from 'react';

interface ArgumentFieldOption {
    value: string;
    title: string;
};

interface ArgumentFieldInputProps {
    type: 'number';
    step?: number;
    min?: number;
    max?: number;
};

interface ArgumentFieldConfig {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox';
    fieldValue: string | number | boolean;
    variant: 'canvas';
    options?: ArgumentFieldOption[];
    inputProps?: ArgumentFieldInputProps;
};

interface ModifierConfigProps {
    children?: ReactNode;
};

interface ArgumentFieldProps {
    arg: IArgumentDefinition;
    index: number;
    value?: string | number | boolean;
    onChange?: (key: string, value: string | number | boolean) => void;
};

const ModifierConfig = ({ children }: ModifierConfigProps) => (
    <Container className="d-flex column gap-05">
        {children}
    </Container>
);

const getArgumentFieldProps = (arg: IArgumentDefinition, index: number): ArgumentFieldConfig => {
    const label = arg.label;
    const fieldKey = `arg-${arg.argument}-${index}`;

    if (arg.type === 'boolean') {
        return {
            label,
            fieldKey,
            fieldType: 'checkbox',
            fieldValue: true,
            variant: 'canvas'
        };
    }

    if (arg.type === 'select') {
        return {
            label,
            fieldKey,
            fieldType: 'select',
            fieldValue: '',
            options: (arg.options || []).map((opt) => ({ value: opt.key, title: opt.label })),
            variant: 'canvas'
        };
    }

    if (arg.type === 'frame') {
        return {
            label,
            fieldKey,
            fieldType: 'select',
            fieldValue: 'Frame 1',
            options: [{ value: 'frame-1', title: 'Frame 1' }],
            variant: 'canvas'
        };
    }

    let inputProps: ArgumentFieldInputProps | undefined;
    if (arg.type === 'number') {
        inputProps = {
            type: 'number',
            step: arg.step,
            min: arg.min,
            max: arg.max
        };
    }

    return {
        label,
        fieldKey,
        fieldType: 'input',
        fieldValue: '',
        variant: 'canvas',
        inputProps
    };
};

const getInitialValue = (arg: IArgumentDefinition, fieldType: string): string | number | boolean => {
    const raw = arg.value ?? arg.default;
    if (fieldType === 'checkbox') return Boolean(raw);
    if (raw !== undefined) return String(raw);
    return '';
};

export const ArgumentField = ({ arg, index, value, onChange }: ArgumentFieldProps) => {
    const fieldProps = getArgumentFieldProps(arg, index);
    let currentValue: string | number | boolean = getInitialValue(arg, fieldProps.fieldType);
    if (value !== undefined) {
        currentValue = value;
    }

    const handleFieldChange = (_: string, nextValue: string | number | boolean) => {
        onChange?.(arg.argument, nextValue);
    };

    return (
        <FormFieldRHF
            label={fieldProps.label}
            fieldType={fieldProps.fieldType}
            variant={fieldProps.variant}
            fieldKey={fieldProps.fieldKey}
            fieldValue={currentValue}
            options={fieldProps.options}
            inputProps={fieldProps.inputProps}
            onFieldChange={handleFieldChange}
        />
    );
};

export default ModifierConfig;
