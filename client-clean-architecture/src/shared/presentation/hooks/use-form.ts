import { useCallback, useState } from 'react';
import useFormValidation, { ValidationSchema } from './use-form-validation';

type FieldBind<T, K extends keyof T> = {
    name: K;
    value: T[K];
    onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | T[K]
    ) => void;
    onBlur: () => void;
    error?: string;
};

type UseFormOptions<T extends Record<string, any>> = {
    initialValues: T;
    schema?: ValidationSchema<T>;
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
};

const getEventValue = (e: any) => {
    if(!e || !e.target) return e;

    const target = e.target as HTMLInputElement;
    if(target.type === 'checkbox'){
        return target.checked;
    }

    if(target.type === 'number'){
        return target.value === '' ? '' : Number(target.value);
    }

    return target.value;
};

const useForm = <T extends Record<string, any>>(opts: UseFormOptions<T>) => {
    const {
        initialValues,
        schema,
        validateOnChange = false,
        validateOnBlur = true
    } = opts;

    const [values, setValues] = useState<T>(initialValues);
    const validation = useFormValidation<T>(schema ?? {});

    const setValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
        setValues((prev) => {
            if(Object.is(prev[name], value)) return prev;
            return { ...prev, [name]: value };
        });

        if(schema && validateOnChange){
            validation.checkField(name, value, { 
                ...values, 
                [name]: value 
            });
        }else{
            validation.clearError(name);
        }
    }, [schema, validateOnChange, validation.checkField, validation.clearError, values]);

    const field = useCallback(<K extends keyof T>(name: K): FieldBind<T, K> => {
        return {
            name,
            value: values[name],
            onChange: (eventOrValue) => {
                const nextValue = getEventValue(eventOrValue);
                setValue(name, nextValue);
            },
            onBlur: () => {
                if(!schema || !validateOnBlur) return;

                validation.checkField(name, values[name], values);
            },
            error: validation.errors[name]
        };
    }, [values, validation.errors, setValue, schema, validateOnBlur, validation.checkField]);

    const validateForm = useCallback((fields?: Array<keyof T>) => {
        validation.validate(values, fields);
    }, [validation.validate, values]);

    const handleSubmit = useCallback((onValid: (data: T) => void | Promise<void>) => async (e?: React.FormEvent) => {
        e?.preventDefault();

        if(schema){
            const { isValid } = validation.validate(values);
            if(!isValid) return;
        }

        await onValid(values);
    }, [schema, validation.validate, values]);

    const reset = useCallback((next?: Partial<T>) => {
        setValues(() => ({ ...initialValues, ...(next ?? {}) } as T));
        validation.setErrors({});
    }, [initialValues, validation.setErrors]);

    return {
        values,
        errors: validation.errors,
        field,
        setValues,
        setValue,
        reset,
        validateForm,
        handleSubmit,
        setErrors: validation.setErrors
    };
};

export default useForm;