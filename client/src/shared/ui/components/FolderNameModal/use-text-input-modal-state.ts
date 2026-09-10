import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { useCallback, useState } from 'react';

interface UseTextInputModalStateOptions {
    requiredMessage: string;
    submitErrorTitle: string;
    onSubmit: (value: string) => Promise<void>;
    onSubmitted: () => void;
}

const useTextInputModalState = ({
    requiredMessage,
    submitErrorTitle,
    onSubmit,
    onSubmitted
}: UseTextInputModalStateOptions) => {
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const reset = useCallback((nextValue = '') => {
        setValue(nextValue);
        setError(undefined);
        setIsSubmitting(false);
    }, []);

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
