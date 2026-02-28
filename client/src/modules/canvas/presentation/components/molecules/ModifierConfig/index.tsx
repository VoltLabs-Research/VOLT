import type { ReactNode } from 'react';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import type { IArgumentDefinition } from '@/modules/plugin/domain/entities';

interface ModifierConfigProps {
    children?: ReactNode;
}

const ModifierConfig = ({ children }: ModifierConfigProps) => (
    <Container className="d-flex column gap-05">
        {children}
    </Container>
);

const getArgumentFieldProps = (arg: IArgumentDefinition, index: number) => {
    const label = arg.label;
    const fieldKey = `arg-${arg.argument}-${index}`;

    if(arg.type === 'boolean'){
        return { label, fieldKey, fieldType: 'checkbox' as const, fieldValue: true, variant: 'canvas' as const };
    }

    if(arg.type === 'select'){
        return {
            label, fieldKey, fieldType: 'select' as const, fieldValue: '',
            options: (arg.options || []).map((opt) => ({ value: opt.key, title: opt.label })),
            variant: 'canvas' as const
        };
    }

    if(arg.type === 'frame'){
        return {
            label, fieldKey, fieldType: 'select' as const, fieldValue: 'Frame 1',
            options: [{ value: 'frame-1', title: 'Frame 1' }],
            variant: 'canvas' as const
        };
    }

    return {
        label, fieldKey, fieldType: 'input' as const, fieldValue: '', variant: 'canvas' as const,
        inputProps: arg.type === 'number' ? { type: 'number', step: arg.step, min: arg.min, max: arg.max } : undefined
    };
};

interface ArgumentFieldProps {
    arg: IArgumentDefinition;
    index: number;
    value?: string | number | boolean;
    onChange?: (key: string, value: string | number | boolean) => void;
}

const getInitialValue = (arg: IArgumentDefinition, fieldType: string) => {
    const raw = arg.value ?? arg.default;
    if (fieldType === 'checkbox') return Boolean(raw);
    if (raw !== undefined) return String(raw);
    return '';
};

const ArgumentField = ({ arg, index, value, onChange }: ArgumentFieldProps) => {
    const fieldProps = getArgumentFieldProps(arg, index);
    const currentValue = value !== undefined ? value : getInitialValue(arg, fieldProps.fieldType);

    return (
        <FormField
            label={fieldProps.label}
            fieldType={fieldProps.fieldType}
            variant={fieldProps.variant}
            fieldKey={fieldProps.fieldKey}
            fieldValue={currentValue}
            options={fieldProps.options}
            inputProps={fieldProps.inputProps}
            onFieldChange={(_, v) => {
                onChange?.(arg.argument, v);
            }}
        />
    );
};

export { ArgumentField };
export default ModifierConfig;
