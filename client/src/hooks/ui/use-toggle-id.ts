import { useState, useCallback } from 'react';

const useToggleId = <T = string>() => {
    const [openId, setOpenId] = useState<T | null>(null);

    const toggle = useCallback((id: T) => {
        setOpenId((prev) => prev === id ? null : id);
    }, []);

    const close = useCallback(() => setOpenId(null), []);

    return { openId, toggle, close };
};

export default useToggleId;
