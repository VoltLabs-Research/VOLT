import { updateSocketAuthToken } from '@/modules/socket/core/services/socket-auth-session';
import { buildKeys, createQuery, withSuccess } from '@/shared/infrastructure/query/create-paginated-query';
import service from '../api/service';
import queryClient from '@/shared/infrastructure/query/query-client';
import TokenStorage from '../services/token-storage';
import { useMutation } from '@tanstack/react-query';
import type { ChangePasswordInputDTO, ChangePasswordOutputDTO } from '../api/dtos/change-password';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from '../api/dtos/check-email';
import type { SignInInputDTO, SignInOutputDTO } from '../api/dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from '../api/dtos/sign-up';
import type { UpdateAvatarInputDTO } from '../api/dtos/update-avatar';
import type { UpdateProfileInputDTO } from '../api/dtos/update-profile';
import type { User } from '../api/entities/user';
import type { QueryOptions, MutationOptions } from '@/shared/infrastructure/query/create-paginated-query';

type AuthQueryKeyMap = Record<'currentUser' | 'passwordInfo', void>;

export const KEYS = buildKeys<AuthQueryKeyMap>('auth');

export const AUTH_QUERY_KEYS = KEYS;

const currentUser = createQuery(KEYS.currentUser, () => service.getMe({}));
export const passwordInfoQuery = createQuery(KEYS.passwordInfo, () => service.getPasswordInfo({}));

export const useCurrentUserQuery = (options?: QueryOptions<User>) => currentUser(undefined, { staleTime: Infinity, ...options });
export const fetchCurrentUser = () => currentUser.fetch(undefined, { staleTime: 0 });
export const clearCurrentUserQueryData = async () => {
    await queryClient.cancelQueries({ queryKey: KEYS.currentUser() });
    currentUser.clear(undefined);
};

export const useSignInMutation = (options?: MutationOptions<SignInOutputDTO, SignInInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.signIn,
        onSuccess: withSuccess((data) => currentUser.set(undefined, data.user), options)
    });
};

export const useSignUpMutation = (options?: MutationOptions<SignUpOutputDTO, SignUpInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.signUp,
        onSuccess: withSuccess((data) => currentUser.set(undefined, data.user), options)
    });
};

export const useCheckEmailMutation = (options?: MutationOptions<CheckEmailOutputDTO, CheckEmailInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.checkEmail
    });
};

export const useUpdateMeMutation = (options?: MutationOptions<User, UpdateProfileInputDTO | UpdateAvatarInputDTO>) => {
    return useMutation({
        ...options,
        mutationFn: service.updateMe,
        onSuccess: withSuccess((data) => currentUser.set(undefined, data), options)
    });
};

export const useDeleteMeMutation = (options?: MutationOptions<void, void>) => {
    return useMutation({
        ...options,
        mutationFn: () => service.deleteMe({}),
        onSuccess: withSuccess(() => currentUser.clear(undefined), options)
    });
};

export const useChangePasswordMutation = (options?: MutationOptions<ChangePasswordOutputDTO, ChangePasswordInputDTO>) => {
    const tokenStorage = new TokenStorage();
    
    return useMutation({
        ...options,
        mutationFn: async (data) => {
            const result = await service.changePassword(data);
            tokenStorage.setToken(result.token);
            return result;
        },
        onSuccess: withSuccess((data) => {
            updateSocketAuthToken(data.token);
            currentUser.set(undefined, data.user);
            passwordInfoQuery.invalidate(undefined);
        }, options)
    });
};
