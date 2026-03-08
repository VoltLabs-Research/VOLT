import { get, post } from '@/app/core/http/utilities/create-service';
import type { GuestIdentity } from '../../entities/guest-identity';
import type { SignInInputDTO, SignInOutputDTO } from '../../dtos/sign-in';
import type { SignUpInputDTO, SignUpOutputDTO } from '../../dtos/sign-up';
import type { CheckEmailOutputDTO } from '../../dtos/check-email';

const endpoints = {
    signIn: post<SignInInputDTO, SignInOutputDTO>('/sign-in'),
    signUp: post<SignUpInputDTO, SignUpOutputDTO>('/sign-up', {
        omit: ['passwordConfirm']
    }),
    checkEmail: post<{ email: string }, CheckEmailOutputDTO>('/check-email'),
    getGuestIdentity: get<{ seed: string }, GuestIdentity>('/guest-identity')
};

export default endpoints;
