import { getAccessDeniedMessage, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import { useCallback, useState } from 'react';

const useAccessDenied = () => {
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>();

    const setDeniedState = useCallback((error: unknown) => {
        setAccessDenied(true);
        setAccessDeniedMessage(getAccessDeniedMessage(error));
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
