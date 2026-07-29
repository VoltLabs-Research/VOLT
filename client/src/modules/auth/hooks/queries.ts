import { updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { buildKeys, createMutation, createQuery } from '@/shared/query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import service from '../api/service';
import queryClient from '@/shared/query/query-client';
import { tokenStorage } from '@/shared/auth/token-storage';
import type {
    UpdatePasswordInput,
    SignInInput
} from '@volt/contracts/modules/auth/http';
import type {
    AuthSession,
    CheckEmailResponse,
    OAuthProviders,
    User
} from '@volt/contracts/modules/auth/domain';
import type {
    CheckEmailParams,
    SignUpFormInput,
    UpdateMeInput
} from '../contracts/forms';
import type { QueryOptions } from '@/shared/query';

type AuthQueryKeyMap = Record<'currentUser' | 'passwordInfo' | 'oauthProviders', void>;

const KEYS = buildKeys<AuthQueryKeyMap>('auth');

registerPreservedQueryKey(KEYS.currentUser()[0] as string);

const currentUser = createQuery(KEYS.currentUser, () => service.getMe({}));
export const passwordInfoQuery = createQuery(KEYS.passwordInfo, () => service.getPasswordInfo({}));
const oauthProviders = createQuery(KEYS.oauthProviders, () => service.getAvailableOAuthProviders({}));

export const useCurrentUserQuery = (options?: QueryOptions<User>) => currentUser(undefined, {
    staleTime: Infinity,
    ...options
});
export const useOAuthProvidersQuery = (options?: QueryOptions<OAuthProviders>) =>
    oauthProviders(undefined, {
        staleTime: Infinity,
        ...options
    });
export const fetchCurrentUser = () => currentUser.fetch(undefined, { staleTime: 0 });
export const clearCurrentUserQueryData = async () => {
    await queryClient.cancelQueries({ queryKey: KEYS.currentUser() });
    currentUser.clear(undefined);
};

export const useSignInMutation = createMutation<AuthSession, SignInInput>(
    service.signIn,
    (data) => currentUser.set(undefined, data.user)
);

export const useSignUpMutation = createMutation<AuthSession, SignUpFormInput>(
    service.signUp,
    (data) => currentUser.set(undefined, data.user)
);

export const useCheckEmailMutation = createMutation<CheckEmailResponse, CheckEmailParams>(service.checkEmail);

export const useUpdateMeMutation = createMutation<User, UpdateMeInput>(
    service.updateMe,
    (data) => currentUser.set(undefined, data)
);

export const useDeleteMeMutation = createMutation<void, void>(
    () => service.deleteMe({}),
    () => currentUser.clear(undefined)
);

export const useChangePasswordMutation = createMutation<AuthSession, UpdatePasswordInput>(
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
