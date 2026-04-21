import { updateSocketAuthToken } from '@/modules/socket/core/services/socket-auth-session';
import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import service from '../api/service';
import queryClient from '@/shared/infrastructure/query/query-client';
import { tokenStorage } from '@/shared/auth/token-storage';
import type { ChangePasswordInputDTO, ChangePasswordOutputDTO } from '../api/dtos/change-password';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from '../api/dtos/check-email';
import type { SignInInputDTO, SignInOutputDTO } from '../api/dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from '../api/dtos/sign-up';
import type { UpdateAvatarInputDTO } from '../api/dtos/update-avatar';
import type { UpdateProfileInputDTO } from '../api/dtos/update-profile';
import type { User } from '../api/entities/user';
import type { QueryOptions } from '@/shared/infrastructure/query';

type AuthQueryKeyMap = Record<'currentUser' | 'passwordInfo', void>;

export const KEYS = buildKeys<AuthQueryKeyMap>('auth');

registerPreservedQueryKey(KEYS.currentUser()[0] as string);

const currentUser = createQuery(KEYS.currentUser, () => service.getMe({}));
export const passwordInfoQuery = createQuery(KEYS.passwordInfo, () => service.getPasswordInfo({}));

export const useCurrentUserQuery = (options?: QueryOptions<User>) => currentUser(undefined, { staleTime: Infinity, ...options });
export const fetchCurrentUser = () => currentUser.fetch(undefined, { staleTime: 0 });
export const clearCurrentUserQueryData = async () => {
    await queryClient.cancelQueries({ queryKey: KEYS.currentUser() });
    currentUser.clear(undefined);
};

export const useSignInMutation = createMutation<SignInOutputDTO, SignInInputDTO>(
    service.signIn,
    (data) => currentUser.set(undefined, data.user)
);

export const useSignUpMutation = createMutation<SignUpOutputDTO, SignUpInputDTO>(
    service.signUp,
    (data) => currentUser.set(undefined, data.user)
);

export const useCheckEmailMutation = createMutation<CheckEmailOutputDTO, CheckEmailInputDTO>(service.checkEmail);

export const useUpdateMeMutation = createMutation<User, UpdateProfileInputDTO | UpdateAvatarInputDTO>(
    service.updateMe,
    (data) => currentUser.set(undefined, data)
);

export const useDeleteMeMutation = createMutation<void, void>(
    () => service.deleteMe({}),
    () => currentUser.clear(undefined)
);

export const useChangePasswordMutation = createMutation<ChangePasswordOutputDTO, ChangePasswordInputDTO>(
    async (data) => {
        const result = await service.changePassword(data);
        tokenStorage.setToken(result.token);
        return result;
    },
    (data) => {
        updateSocketAuthToken(data.token);
        currentUser.set(undefined, data.user);
        passwordInfoQuery.invalidate(undefined);
    }
);
