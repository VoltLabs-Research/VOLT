import { useCallback, useState } from 'react';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const isEmpty = (value: unknown) => {
    if(value === null || value === undefined){
        return true;
    }

    if(typeof value === 'string'){
        return value.trim().length === 0;
    }

    if(Array.isArray(value)){
        return value.length === 0;
    }

    return false;
};

type ValidateFn<T, K extends keyof T> = (
    value: T[K],
    formData: Partial<T>
) => boolean | string;

export type ValidationRule<T, K extends keyof T> = {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    validate?: ValidateFn<T, K>;
    message?: string;
};

export type ValidationSchema<T extends Record<string, any>> = Partial<{
    [K in keyof T]: ValidationRule<T, K> | Array<ValidationRule<T, K>>
}>;

const toRulesArray = <T, K extends keyof T>(
    rules: ValidationRule<T, K> | Array<ValidationRule<T, K>>
) => (Array.isArray(rules) ? rules : [rules]);

const useFormValidation = <T extends Record<string, any>>(schema: ValidationSchema<T>) => {
    const [errors, setErrors] = useState<FieldErrors<T>>({});

    const validateField = useCallback(<K extends keyof T>(name: K, value: T[K], formData: Partial<T> = {}) => {
        const rules = schema[name];
        if(!rules) return '';

        for(const rule of toRulesArray(rules)){
            if(rule.required && isEmpty(value)){
                return rule.message ?? 'This field is required';
            }

            // String checks
            if(typeof value === 'string'){
                if(rule.minLength !== undefined && value.length < rule.minLength){
                    return rule.message ?? `Must be at least ${rule.minLength} characters`;
                }

                if(rule.maxLength !== undefined && value.length > rule.maxLength){
                    return rule.message ?? `Must be no more than ${rule.maxLength} characters`;
                }

                if(rule.pattern && !rule.pattern.test(value)){
                    return rule.message ?? 'Invalid format';
                }
            }

            // Custom validate
            if(rule.validate){
                const result = rule.validate(value, formData);
                
                if(typeof result === 'string'){
                    return result;
                }

                if(result === false){
                    return rule.message ?? 'Invalid value';
                }
            }

            return '';
        }
    }, [schema]);

    const checkField = useCallback(<K extends keyof T>(name: K, value: T[K], formData: Partial<T> = {}) => {
        const error = validateField(name, value, formData);

        setErrors((prev) => {
            const prevError = prev[name];
            if(prevError === error) return prev;

            const next: FieldErrors<T> = { ...prev };
            if(error){
                next[name] = error;
            }else{
                delete next[name];
            }

            return next;
        });

        return error
    }, [validateField]);

    const validate = useCallback((formData: Partial<T>, fieldsToValidate?: Array<keyof T>) => {
        const fields = fieldsToValidate ?? (Object.keys(schema) as Array<keyof T>);
        const nextErrors: FieldErrors<T> = {};
        let isValid = true;

        for(const key of fields){
            const error = validateField(key, formData[key] as any, formData);
            if(error){
                nextErrors[key] = error;
                isValid = false;
            }
        }

        setErrors(nextErrors);
        return { isValid, errors: nextErrors };
    }, [schema, validateField]);

    const clearError = useCallback((name: keyof T) => {
        setErrors((prev) => {
            if(!(name in prev)) return prev;

            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, []);

    const clearAllErrors = useCallback(() => setErrors({}), []);

    return {
        errors,
        setErrors,
        validateField,
        checkField,
        validate,
        clearError,
        clearAllErrors
    };
};

export default useFormValidation;