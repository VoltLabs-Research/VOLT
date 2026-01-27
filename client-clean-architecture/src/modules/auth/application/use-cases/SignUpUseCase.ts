import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { ITokenStorage } from '../../domain/repositories/ITokenStorage';
import type { SignUpDetails, AuthResponse } from '../../domain/entities';

export class SignUpUseCase {
    constructor(
        private readonly authRepository: IAuthRepository,
        private readonly tokenStorage: ITokenStorage
    ) {}

    async execute(details: SignUpDetails): Promise<AuthResponse> {
        const response = await this.authRepository.signUp(details);
        this.tokenStorage.setToken(response.token);
        return response;
    }
}
