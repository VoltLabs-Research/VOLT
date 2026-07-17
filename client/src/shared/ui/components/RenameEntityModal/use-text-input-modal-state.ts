import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useCallback, useState } from 'react';

interface UseTextInputModalStateOptions {
    initialValue?: string;
    requiredMessage: string;
    submitErrorTitle: string;
    onSubmit: (value: string) => Promise<void>;
    onSubmitted: () => void;
}

const useTextInputModalState = ({
    initialValue = '',
    requiredMessage,
    submitErrorTitle,
    onSubmit,
    onSubmitted
}: UseTextInputModalStateOptions) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const reset = useCallback((nextValue = initialValue) => {
        setValue(nextValue);
        setError(undefined);
        setIsSubmitting(false);
    }, [initialValue]);

    const handleValueChange = useCallback((nextValue: string) => {
        setValue(nextValue);
        setError(undefined);
    }, []);

    const handleSubmit = useCallback(async () => {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
            setError(requiredMessage);
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSubmit(trimmedValue);
            onSubmitted();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: submitErrorTitle
            });

            setError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [onSubmit, onSubmitted, requiredMessage, submitErrorTitle, value]);

    return {
        value,
        error,
        isSubmitting,
        handleValueChange,
        handleSubmit,
        reset
    };
};

export default useTextInputModalState;
