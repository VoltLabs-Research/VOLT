import ApiError from '@/shared/errors/ApiError';
import { useCallback, useState } from 'react';

const useAccessDenied = () => {
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>();

    const setDeniedState = useCallback((error: ApiError) => {
        setAccessDenied(true);
        setAccessDeniedMessage(error.getFriendlyMessage());
    }, []);

    const checkRBACError = useCallback((error: unknown): boolean => {
        if(error instanceof ApiError && error.isPermissionDenied()){
            setDeniedState(error);
            return true;
        }

        return false;
    }, [setDeniedState]);

    return { accessDenied, accessDeniedMessage, checkRBACError };
};

export default useAccessDenied;
