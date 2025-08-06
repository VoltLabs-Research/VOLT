import { useState, useEffect } from 'react';

const useIsMobile = (breakpoint: number = 768): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkDevice = () => {
            setIsMobile(window.innerWidth <= breakpoint);
        };

        checkDevice();

        window.addEventListener('resize', checkDevice);
        return () => {
            window.removeEventListener('resize', checkDevice);
        };
    }, [breakpoint]);

    return isMobile;
};

export default useIsMobile;