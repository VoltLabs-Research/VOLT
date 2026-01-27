import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { PasswordInfo } from '../../domain/entities';

export class GetPasswordInfoUseCase {
    constructor(
        private readonly authRepository: IAuthRepository
    ) {}

    async execute(): Promise<PasswordInfo> {
        return this.authRepository.getPasswordInfo();
    }
}
