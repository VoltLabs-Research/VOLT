import { User } from '../entities';
import {
    ChangePasswordInputDTO,
    CheckEmailOutputDTO,
    GetPasswordInfoOutputDTO,
    SignInInputDTO,
    SignInOutputDTO,
    SignUpInputDTO,
    SignUpOutputDTO
} from '../../application/dtos/index.ts';

export default interface IAuthRepository{
    getMe(): Promise<User>;
    signIn(data: SignInInputDTO): Promise<SignInOutputDTO>;
    signUp(data: SignUpInputDTO): Promise<SignUpOutputDTO>;
    checkEmail(email: string): Promise<CheckEmailOutputDTO>;
    getGuestIdentity(seed: string): Promise<User>;
    updateMe(data: Partial<User> | FormData): Promise<User>;
    getPasswordInfo(): Promise<GetPasswordInfoOutputDTO>;
    changePassword(data: ChangePasswordInputDTO): Promise<void>;
};