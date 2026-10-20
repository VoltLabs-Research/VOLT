import { updateSocketAuthToken } from '@/modules/socket/services/socket-auth-session';
import { buildKeys } from '@/shared/query/query-keys';
import { createMutation } from '@/shared/query/create-mutation';
import { createQuery } from '@/shared/query/create-query';
import { registerPreservedQueryKey } from '@/shared/utils/app-cleanup-registry';
import service from '../api/service';
import queryClient from '@/shared/query/query-client';
import { tokenStorage } from '@/shared/auth/token-storage';
import type {
    UpdatePasswordInput,
    SignInInput,
    SignUpInput
} from '@volt/contracts/modules/auth/http';
import type {
    AuthSession,
    CheckEmailResponse,
    User
} from '@volt/contracts/modules/auth/domain';
import type {
    CheckEmailParams,
    UpdateMeInput
} from '../contracts/forms';

const KEYS = buildKeys<Record<'currentUser' | 'passwordInfo' | 'oauthProviders', void>>('auth');

registerPreservedQueryKey(KEYS.currentUser()[0] as string);

export const currentUserQuery = createQuery(KEYS.currentUser, () => service.getMe({}));
export const passwordInfoQuery = createQuery(KEYS.passwordInfo, () => service.getPasswordInfo({}));
const oauthProviders = createQuery(KEYS.oauthProviders, () => service.getAvailableOAuthProviders({}));

export const useOAuthProvidersQuery = () => oauthProviders(undefined, { staleTime: Infinity });
export const fetchCurrentUser = () => currentUserQuery.fetch(undefined, { staleTime: 0 });
export const clearCurrentUserQueryData = async () => {
    await queryClient.cancelQueries({ queryKey: KEYS.currentUser() });
    currentUserQuery.clear(undefined);
};

export const useSignInMutation = createMutation<AuthSession, SignInInput>(
    service.signIn,
    (data) => currentUserQuery.set(undefined, data.user)
);

export const useSignUpMutation = createMutation<AuthSession, SignUpInput>(
    service.signUp,
    (data) => currentUserQuery.set(undefined, data.user)
);

export const useCheckEmailMutation = createMutation<CheckEmailResponse, CheckEmailParams>(service.checkEmail);

export const useUpdateMeMutation = createMutation<User, UpdateMeInput>(
    service.updateMe,
    (data) => currentUserQuery.set(undefined, data)
);

export const useDeleteMeMutation = createMutation<void, void>(
    () => service.deleteMe({}),
    () => currentUserQuery.clear(undefined)
);

export const useChangePasswordMutation = createMutation<AuthSession, UpdatePasswordInput>(
    async (data) => {
        const result = await service.changePassword(data);
        tokenStorage.setToken(result.token);
        return result;
    },
    (data) => {
        updateSocketAuthToken(data.token);
        currentUserQuery.set(undefined, data.user);
        passwordInfoQuery.invalidate(undefined);
    }
);
