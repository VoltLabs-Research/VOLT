import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { ErrorCodes } from "../../../../../core/constants/error-codes";
import { GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO } from "../../dtos/user/GetGuestIdentityDTO";
import { IAvatarService } from "../../../domain/ports/IAvatarService";
import crypto from 'node:crypto';

export default class GetGuestIdentityUseCase implements IUseCase<GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO, ApplicationError>{
    constructor(
        private avatarService: IAvatarService
    ){}

    async execute(input: GetGuestIdentityInputDTO): Promise<Result<GetGuestIdentityOutputDTO, ApplicationError>>{
        if(!input.seed){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED,
                'Seed is required'
            ));
        }

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