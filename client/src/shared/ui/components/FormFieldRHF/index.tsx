import './FormField.css';
import { Controller } from 'react-hook-form';
import DefaultFieldRenderer from './DefaultFieldRenderer';
import InlineCanvasFieldRenderer from './InlineCanvasFieldRenderer';
import type {
    CanvasStyleProps,
    ControlledProps,
    ControllerField,
    FieldRendererProps,
    FormFieldChangeEvent,
    FormFieldRHFProps,
    SyntheticChangeEvent,
    UncontrolledProps
} from '@/shared/contracts/form-field';
import type { FieldValues } from 'react-hook-form';

const isControlled = <TForm extends FieldValues>(
    props: FormFieldRHFProps<TForm>
): props is ControlledProps<TForm> => {
    return props.control != null;
};

const isCanvasStyle = <TForm extends FieldValues>(
    props: FormFieldRHFProps<TForm>
): props is CanvasStyleProps => {
    return 'fieldKey' in props;
};

const isFieldChangeEvent = (value: unknown): value is FormFieldChangeEvent => {
    return Boolean(value && typeof value === 'object' && 'target' in value);
};

const buildSyntheticChangeEvent = (name: string, value: unknown): SyntheticChangeEvent => {
    const target = {
        name,
        value: String(value ?? '')
    };

    return {
        target,
        currentTarget: target
    };
};

const createCanvasControllerField = (props: CanvasStyleProps): ControllerField => {
    return {
        value: props.fieldValue,
        onChange: (nextValue: unknown) => {
            if (typeof nextValue !== 'string' && typeof nextValue !== 'number' && typeof nextValue !== 'boolean') {
                return;
            }

            props.onFieldChange(props.fieldKey, nextValue);
        },
        onBlur: () => {},
        name: props.fieldKey,
        ref: () => {}
    };
};

const createUncontrolledControllerField = (props: UncontrolledProps): ControllerField => {
    const fieldName = props.name ?? '';

    return {
        value: props.value ?? '',
        onChange: (eventOrValue: unknown) => {
            if (!props.onChange) return;
            if (isFieldChangeEvent(eventOrValue)) {
                props.onChange(eventOrValue);
                return;
            }

            props.onChange(buildSyntheticChangeEvent(fieldName, eventOrValue));
        },
        onBlur: props.onBlur ?? (() => {}),
        name: fieldName,
        ref: () => {}
    };
};

const FormFieldRHF = <TForm extends FieldValues = FieldValues>(props: FormFieldRHFProps<TForm>) => {
    const rendererProps: Omit<FieldRendererProps, 'field' | 'error'> = {
        label: props.label,
        fieldType: props.fieldType ?? 'input',
        placeholder: props.placeholder,
        icon: props.icon,
        options: props.options ?? [],
        rows: props.rows ?? 3,
        className: props.className ?? '',
        disabled: props.disabled ?? false,
        type: props.type,
        autoFocus: props.autoFocus ?? false,
        variant: props.variant ?? 'default',
        suggestions: props.suggestions,
        onFetchSuggestions: props.onFetchSuggestions,
        autocomplete: props.autocomplete,
        inputProps: props.inputProps,
        isLoading: props.isLoading ?? false
    };

    const renderFieldRenderer = (field: ControllerField, error?: string) => {
        const FieldRenderer = rendererProps.variant === 'default'
            ? DefaultFieldRenderer
            : InlineCanvasFieldRenderer;

        return <FieldRenderer field={field} error={error} {...rendererProps} />;
    };

    if (isControlled(props)) {
        return (
            <Controller
                name={props.name}
                control={props.control}
                render={({ field, fieldState }) => renderFieldRenderer(field, fieldState.error?.message)}
            />
        );
    }

    if (isCanvasStyle(props)) {
        return renderFieldRenderer(createCanvasControllerField(props), props.error);
    }

    return renderFieldRenderer(createUncontrolledControllerField(props), props.error);
};

export default FormFieldRHF;
