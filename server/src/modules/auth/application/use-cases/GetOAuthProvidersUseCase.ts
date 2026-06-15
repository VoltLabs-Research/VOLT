import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { getConfiguredOAuthProviders } from '@modules/auth/infrastructure/http/oauth/config';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

export interface GetOAuthProvidersOutputDTO {
    providers: OAuthProvider[];
}

@injectable()
export default class GetOAuthProvidersUseCase implements IUseCase<void, GetOAuthProvidersOutputDTO, ApplicationError> {
    async execute(): Promise<Result<GetOAuthProvidersOutputDTO, ApplicationError>> {
        return Result.ok({ providers: getConfiguredOAuthProviders() });
    }
}
