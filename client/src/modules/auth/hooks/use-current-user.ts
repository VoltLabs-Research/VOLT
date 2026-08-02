import { currentUserQuery } from './queries';
import { useAuthStore } from '../store/use-auth-store';
import type { User } from '@volt/contracts/modules/auth/domain';

export const useCurrentUser = (): User | null => {
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const hasToken = useAuthStore((state) => state.hasToken);

    return currentUserQuery(undefined, {
        staleTime: Infinity,
        enabled: isInitialized && hasToken
    }).data ?? null;
};
