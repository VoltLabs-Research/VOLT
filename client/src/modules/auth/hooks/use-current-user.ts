import { useCurrentUserQuery } from './queries';
import { useAuthStore } from '../stores/use-auth-store';
import type { User } from '../api/entities/user';

export const useCurrentUser = (): User | null => {
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const hasToken = useAuthStore((state) => state.hasToken);
    const { data } = useCurrentUserQuery({
        enabled: isInitialized && hasToken
    });
    return data ?? null;
};
