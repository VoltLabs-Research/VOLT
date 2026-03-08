import queryClient from '@/shared/infrastructure/query/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

interface QueryProviderProps {
    children: ReactNode;
};

const QueryProvider = ({ children }: QueryProviderProps) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default QueryProvider;
