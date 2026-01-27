import type { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import type { CheckEmailResult } from '../../domain/entities';

export class CheckEmailUseCase {
    constructor(
        private readonly authRepository: IAuthRepository
    ) {}

    async execute(email: string): Promise<CheckEmailResult> {
        return this.authRepository.checkEmail(email);
    }
}
