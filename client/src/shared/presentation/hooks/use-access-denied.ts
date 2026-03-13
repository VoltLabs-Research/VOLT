import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { useCallback, useState } from 'react';

const useAccessDenied = () => {
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>();

    const setDeniedState = useCallback((error: unknown) => {
        setAccessDenied(true);
        const userError = reportError(error, { surface: ErrorSurface.Silent });
        setAccessDeniedMessage(userError.title);
    }, []);

    const checkAccessDeniedError = useCallback((error: unknown): boolean => {
        if(isAccessDeniedError(error)){
            setDeniedState(error);
            return true;
        }

        return false;
    }, [setDeniedState]);

    return { accessDenied, accessDeniedMessage, checkAccessDeniedError };
};

export default useAccessDenied;
