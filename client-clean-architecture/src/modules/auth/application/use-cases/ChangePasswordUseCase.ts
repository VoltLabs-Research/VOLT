import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { ChangePasswordPayload } from '../../domain/entities';

export class ChangePasswordUseCase {
    constructor(
        private readonly authRepository: IAuthRepository
    ) {}

    async execute(payload: ChangePasswordPayload): Promise<void> {
        await this.authRepository.changePassword(payload);
    }
}
