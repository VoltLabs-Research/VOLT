import { get, post, patch, del } from '../../shared/routing';
import type { SignInInput, SignUpInput, UpdatePasswordInput, UpdateAccountInput } from './http';
import type {
    AuthSession,
    Account,
    CheckEmailResponse,
    OAuthProviders,
    GuestIdentity,
    PasswordInfo,
    DeleteAccountResponse
} from './domain';

/**
 * Every client-facing auth endpoint, typed by request/response. OAuth
 * login/callback are browser-redirect routes (passport) and are intentionally
 * not modelled here — they carry no JSON contract.
 */
export const authRoutes = {
    signIn: post<SignInInput, AuthSession>('/api/auth/sessions'),
    localSignIn: post<never, AuthSession>('/api/auth/sessions/local'),
    signUp: post<SignUpInput, AuthSession>('/api/auth/users'),
    checkEmail: get<CheckEmailResponse>('/api/auth/emails/:email/availability'),
    oauthProviders: get<OAuthProviders>('/api/auth/oauth/providers'),
    guestIdentity: get<GuestIdentity>('/api/auth/guest-identity'),
    passwordInfo: get<PasswordInfo>('/api/auth/password/info'),
    updatePassword: patch<UpdatePasswordInput, AuthSession>('/api/auth/me/password'),
    getMyAccount: get<Account>('/api/auth/me'),
    updateMyAccount: patch<UpdateAccountInput, Account>('/api/auth/me'),
    deleteMyAccount: del<DeleteAccountResponse>('/api/auth/me')
} as const;
