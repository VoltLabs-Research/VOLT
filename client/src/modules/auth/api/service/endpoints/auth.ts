import { get, post } from '@/app/core/http/utilities/create-service';
import type { GuestIdentity } from '../../entities/guest-identity';
import type { SignInInputDTO, SignInOutputDTO } from '../../dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from '../../dtos/sign-up';
import type { CheckEmailOutputDTO } from '../../dtos/check-email';

const endpoints = {
    signIn: post<SignInInputDTO, SignInOutputDTO>('/sessions'),
    signUp: post<SignUpInputDTO, SignUpOutputDTO>('/users', {
        omit: ['passwordConfirm']
    }),
    checkEmail: get<{ email: string }, CheckEmailOutputDTO>('/emails/:email/availability'),
    getGuestIdentity: get<{ seed: string }, GuestIdentity>('/guest-identity')
};

export default endpoints;
