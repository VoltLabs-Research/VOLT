import type { ITokenStorage } from '../../domain/repositories';

export class SetAuthTokenUseCase {
    constructor(private readonly tokenStorage: ITokenStorage) {}

    execute(token: string): void {
        this.tokenStorage.setToken(token);
    }
}
