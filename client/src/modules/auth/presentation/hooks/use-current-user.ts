import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';

export const useCurrentUser = () => useAuthStore((state) => state.user);
