import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { ITokenStorage } from '../../domain/repositories/ITokenStorage';
import type { User } from '../../domain/entities';

export class GetMeUseCase {
    constructor(
        private readonly authRepository: IAuthRepository,
        private readonly tokenStorage: ITokenStorage
    ) {}

    async execute(): Promise<User | null> {
        const token = this.tokenStorage.getToken();
        if (!token) {
            return null;
        }

        try {
            return await this.authRepository.getMe();
        } catch {
            this.tokenStorage.removeToken();
            return null;
        }
    }
}
