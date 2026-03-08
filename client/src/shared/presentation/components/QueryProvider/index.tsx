import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';

interface QueryProviderProps {
    children: ReactNode;
}

const QueryProvider = ({ children }: QueryProviderProps) => {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
};

export default QueryProvider;
