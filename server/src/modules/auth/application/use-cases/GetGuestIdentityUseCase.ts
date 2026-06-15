import { ErrorCodes } from '@core/constants/error-codes';
import { GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO } from '@modules/auth/application/dtos/GetGuestIdentityDTO';
import type { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import crypto from 'node:crypto';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetGuestIdentityUseCase implements IUseCase<GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.AvatarService) private readonly avatarService: IAvatarService
    ) {}

    async execute(input: GetGuestIdentityInputDTO): Promise<Result<GetGuestIdentityOutputDTO, ApplicationError>>{
        // `seed` comes from an untyped query param; without it crypto.update(undefined) threw a 500.
        if (typeof input.seed !== 'string' || input.seed.length === 0) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED,
                'A seed query parameter is required'
            ));
        }

        const hash = crypto.createHash('md5').update(input.seed).digest('hex');
        const { buffer } = this.avatarService.generateIdenticon(hash);
        const avatar = `data:image/svg+xml;base64,${buffer.toString('base64')}`;

        const shortHash = hash.substring(0, 4).toUpperCase();

        return Result.ok({
            avatar,
            firstName: 'Guest',
            lastName: shortHash
        });
    }
}
