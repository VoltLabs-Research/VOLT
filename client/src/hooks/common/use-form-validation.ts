import { useState, useCallback } from 'react';

export type ValidationRule = {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    validate?: (value: any, formData?: any) => boolean | string;
    message?: string;
};

export type ValidationSchema = {
    [key: string]: ValidationRule | ValidationRule[];
};

export const useFormValidation = <T extends Record<string, any>>(schema: ValidationSchema) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateField = useCallback((name: string, value: any, formData?: Partial<T>) => {
        const rules = schema[name];
        if(!rules) return '';

        const rulesArray = Array.isArray(rules) ? rules : [rules];

        for(const rule of rulesArray){
            if(rule.required && !value){
                return rule.message || 'This field is required';
            }

            if(value){
                if(rule.minLength && value.length < rule.minLength){
                    return rule.message || `Must be at least ${rule.minLength} characters`;
                }

                if(rule.maxLength && value.length > rule.maxLength){
                    return rule.message || `Must be no more than ${rule.maxLength} characters`;
                }

                if(rule.pattern && !rule.pattern.test(value)) {
                    return rule.message || 'Invalid format';
                }

                if(rule.validate){
                    const result = rule.validate(value, formData);
                    if(typeof result === 'string') return result;
                    if(!result) return rule.message || 'Invalid value';
                }
            }
        }

        return '';
    }, [schema]);

    const checkField = useCallback((name: string, value: any, formData?: Partial<T>) => {
        const error = validateField(name, value, formData);
        setErrors((prev) => {
            if(prev[name] === error) return prev;
            const newErrors = { ...prev };
            if(error){
                newErrors[name] = error;
            }else{
                delete newErrors[name];
            }
            return newErrors;
        });
        return error;
    }, [validateField]);

    const validate = useCallback((formData: Partial<T>, fieldsToValidate?: string[]) => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        const fields = fieldsToValidate || Object.keys(schema);

        fields.forEach((key) => {
            const error = validateField(key, formData[key], formData);
            if(error){
                newErrors[key] = error;
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    }, [schema, validateField]);

    const clearError = useCallback((name: string) => {
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });
    }, []);

    return { errors, validate, validateField, checkField, clearError, setErrors };
};
