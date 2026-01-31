import { useCallback, useState, useEffect, useRef } from 'react';
import useFormValidation, { ValidationSchema } from './use-form-validation';

export type FieldBind<T, K extends keyof T> = {
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
    onAutoSave?: (data: T) => void | Promise<void>;
    autoSaveDelay?: number;
    autoSaveOnlyIfChanged?: boolean;
    onSubmit?: (data: T) => void | Promise<void>;
    autoResetOnSubmit?: boolean;
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
        validateOnBlur = true,
        onAutoSave,
        autoSaveDelay = 1000,
        autoSaveOnlyIfChanged = true,
        onSubmit,
        autoResetOnSubmit = false
    } = opts;

    const [values, setValues] = useState<T>(initialValues);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const validation = useFormValidation<T>(schema ?? {});
    const autoSaveTimeoutRef = useRef<number | null>(null);
    const initialValuesRef = useRef<T>(initialValues);

    const hasValuesChanged = useCallback(() => {
        if(!autoSaveOnlyIfChanged) return true;
        
        return Object.keys(values).some(
            key => values[key] !== initialValuesRef.current[key]
        );
    }, [values, autoSaveOnlyIfChanged]);

    const performAutoSave = useCallback(async () => {
        if(!onAutoSave || !hasValuesChanged()){
            return;
        }

        if(schema){
            const { isValid } = validation.validate(values);
            if(!isValid) return;
        }

        try{
            setIsAutoSaving(true);
            await onAutoSave(values);
        }catch(error){
            console.error('Auto-save failed:', error);
        }finally{
            setIsAutoSaving(false);
        }
    }, [onAutoSave, schema, validation, values, hasValuesChanged]);

    useEffect(() => {
        if(!onAutoSave) return;

        if(autoSaveTimeoutRef.current){
            clearTimeout(autoSaveTimeoutRef.current);
        }

        if(hasValuesChanged()){
            autoSaveTimeoutRef.current = window.setTimeout(
                performAutoSave, 
                autoSaveDelay
            );
        }

        return () => {
            if(autoSaveTimeoutRef.current){
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [values, onAutoSave, autoSaveDelay, hasValuesChanged, performAutoSave]);

    useEffect(() => {
        initialValuesRef.current = initialValues;
    }, [initialValues]);

    const setValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
        setValues((prev) => {
            if(Object.is(prev[name], value)) return prev;
            return { 
                ...prev, 
                [name]: value 
            };
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

    const reset = useCallback((next?: Partial<T>) => {
        setValues(() => ({ ...initialValues, ...(next ?? {}) } as T));
        validation.setErrors({});
    }, [initialValues, validation.setErrors]);

    const handleSubmit = useCallback((onValid?: (data: T) => void | Promise<void>) => async (e?: React.FormEvent) => {
        e?.preventDefault();

        if(schema){
            const { isValid } = validation.validate(values);
            if(!isValid) return;
        }

        const submitHandler = onValid || onSubmit;
        if(!submitHandler) return;

        try{
            setIsSubmitting(true);
            await submitHandler(values);
            
            if(autoResetOnSubmit){
                reset();
            }
        }catch(error){
            console.error('Form submission failed:', error);
            throw error;
        }finally{
            setIsSubmitting(false);
        }
    }, [schema, validation.validate, values, onSubmit, autoResetOnSubmit, reset]);

    return {
        values,
        errors: validation.errors,
        field,
        setValues,
        setValue,
        reset,
        validateForm,
        handleSubmit,
        setErrors: validation.setErrors,
        isAutoSaving,
        isSubmitting
    };
};

export default useForm;
