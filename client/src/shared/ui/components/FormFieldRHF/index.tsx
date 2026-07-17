import './FormField.css';
import { Controller } from 'react-hook-form';
import DefaultFieldRenderer from './DefaultFieldRenderer';
import InlineCanvasFieldRenderer from './InlineCanvasFieldRenderer';
import type {
    CanvasStyleProps,
    ControlledProps,
    ControllerField,
    FormFieldChangeEvent,
    FormFieldRHFProps,
    SyntheticChangeEvent,
    UncontrolledProps
} from './FormFieldRHF.types';
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
    const stringValue = String(value ?? '');

    return {
        target: {
            name,
            value: stringValue
        },
        currentTarget: {
            name,
            value: stringValue
        }
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
    const {
        label,
        fieldType = 'input',
        placeholder,
        icon,
        options = [],
        rows = 3,
        className = '',
        disabled = false,
        type,
        autoFocus = false,
        variant = 'default',
        suggestions,
        onFetchSuggestions,
        autocomplete,
        inputProps,
        isLoading = false
    } = props;

    const rendererProps = {
        label,
        fieldType,
        placeholder,
        icon,
        options,
        rows,
        className,
        disabled,
        type,
        autoFocus,
        variant,
        suggestions,
        onFetchSuggestions,
        autocomplete,
        inputProps,
        isLoading
    };

    const renderFieldRenderer = (field: ControllerField, error?: string) => {
        if (variant === 'inline' || variant === 'canvas') {
            return (
                <InlineCanvasFieldRenderer
                    field={field}
                    error={error}
                    {...rendererProps}
                />
            );
        }

        return (
            <DefaultFieldRenderer
                field={field}
                error={error}
                {...rendererProps}
            />
        );
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
