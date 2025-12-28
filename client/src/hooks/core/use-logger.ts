import { useEffect, useRef } from 'react';
import Logger from '@/services/common/logger';

const useLogger = (componentName: string) => {
    const loggerRef = useRef<Logger>(new Logger(componentName));

    useEffect(() => {
        loggerRef.current.log('Mounted');
        return() => {
            loggerRef.current.log('Unmounted');
        };
    }, []);

    return loggerRef.current;
};

export default useLogger;
