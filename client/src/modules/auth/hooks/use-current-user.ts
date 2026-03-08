import { useCurrentUserQuery } from './queries';
import type { User } from '../api/entities/user';
import { useAuthStore } from '../stores/use-auth-store';

export const useCurrentUser = (): User | null => {
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const { data } = useCurrentUserQuery({
        enabled: isInitialized
    });
    return data ?? null;
};
