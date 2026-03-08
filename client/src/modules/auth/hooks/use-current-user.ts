import { useCurrentUserQuery } from './queries';
import { useAuthStore } from '../stores/use-auth-store';
import type { User } from '../api/entities/user';

export const useCurrentUser = (): User | null => {
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const { data } = useCurrentUserQuery({
        enabled: isInitialized
    });
    return data ?? null;
};
