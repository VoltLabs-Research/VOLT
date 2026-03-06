import { useMemo } from 'react';
import { container } from 'tsyringe';

const useResolve = <T>(token: symbol): T => {
    return useMemo(() => container.resolve<T>(token), []);
};

export default useResolve;
