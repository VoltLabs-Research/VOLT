import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { injectable, inject } from 'tsyringe';
import { GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO } from '@modules/auth/application/dtos/GetGuestIdentityDTO';
import { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import crypto from 'node:crypto';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';

@injectable()
export default class GetGuestIdentityUseCase implements IUseCase<GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.AvatarService)
        private avatarService: IAvatarService
    ){}

    async execute(input: GetGuestIdentityInputDTO): Promise<Result<GetGuestIdentityOutputDTO, ApplicationError>>{
        const hash = crypto.createHash('md5').update(input.seed).digest('hex');
        const { buffer } = this.avatarService.generateIdenticon(hash);
        const avatar = `data:image/png;base64,${buffer}`;

        const shortHash = hash.substring(0, 4).toUpperCase();

        return Result.ok({
            avatar,
            firstName: 'Guest',
            lastName: shortHash
        });
    }
};
