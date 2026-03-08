import { get, post } from '@/app/core/http/utilities/create-service';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from '../../dtos/check-email';
import type { GuestIdentity } from '../../entities/guest-identity';
import type { SignInInputDTO, SignInOutputDTO } from '../../dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from '../../dtos/sign-up';

interface GuestIdentityParams {
    seed: string;
};

const endpoints = {
    signIn: post<SignInInputDTO, SignInOutputDTO>('/sessions'),
    signUp: post<SignUpInputDTO, SignUpOutputDTO>('/users', {
        omit: ['passwordConfirm']
    }),
    checkEmail: get<CheckEmailInputDTO, CheckEmailOutputDTO>('/emails/:email/availability'),
    getGuestIdentity: get<GuestIdentityParams, GuestIdentity>('/guest-identity')
};

export default endpoints;
