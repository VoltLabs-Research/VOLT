import type { IAuthRepository } from '../../domain/repositories';
import type { User } from '../../domain/entities';

export class UpdateMeUseCase {
    constructor(private readonly authRepository: IAuthRepository) {}

    async execute(data: Partial<User> | FormData): Promise<User> {
        return this.authRepository.updateMe(data);
    }
}
