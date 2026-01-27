import type { ITokenStorage } from '../../domain/repositories/ITokenStorage';
import type { IErrorHistoryRepository } from '../../domain/repositories/IErrorHistoryRepository';

export class SignOutUseCase {
    constructor(
        private readonly tokenStorage: ITokenStorage,
        private readonly errorHistoryRepository: IErrorHistoryRepository
    ) {}

    execute(): void {
        this.tokenStorage.removeToken();
        this.errorHistoryRepository.clear();
    }
}
