import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { ITokenStorage } from '../../domain/repositories/ITokenStorage';
import type { SignInCredentials, AuthResponse } from '../../domain/entities';

export class SignInUseCase {
    constructor(
        private readonly authRepository: IAuthRepository,
        private readonly tokenStorage: ITokenStorage
    ) {}

    async execute(credentials: SignInCredentials): Promise<AuthResponse> {
        const response = await this.authRepository.signIn(credentials);
        this.tokenStorage.setToken(response.token);
        return response;
    }
}
