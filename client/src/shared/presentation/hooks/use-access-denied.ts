import { useCallback, useState } from 'react';
import ApiError from '@/shared/errors/ApiError';

const useAccessDenied = () => {
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>();

    const checkRBACError = useCallback((error: unknown): boolean => {
        if(ApiError.isRBACError(error)){
            setAccessDenied(true);
            if(error instanceof ApiError){
                setAccessDeniedMessage(error.getFriendlyMessage());
            }
            return true;
        }
        return false;
    }, []);

    return { accessDenied, accessDeniedMessage, checkRBACError };
};

export default useAccessDenied;
