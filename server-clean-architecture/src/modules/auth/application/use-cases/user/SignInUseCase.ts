import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { ErrorCodes } from "../../../../../core/constants/error-codes";
import { SignInInputDTO, SignInOutputDTO } from "../../dtos/user/SignInDTO";
import { IUserRepository } from "../../../domain/ports/IUserRepository";
import { IPasswordHasher } from "../../../domain/ports/IPasswordHasher";
import { ITokenService } from "../../../domain/ports/ITokenService";

export default class SignInUseCase implements IUseCase<SignInInputDTO, SignInOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService
    ){}

    async execute(input: SignInInputDTO): Promise<Result<SignInOutputDTO, ApplicationError>>{
        if(!input.email || !input.password){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTH_CREDENTIALS_MISSING,
                'Email and password are required'
            ));
        }

        const user = await this.userRepository.findByEmailWithPassword(input.email);
        if(!user){
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            ));
        }

        const isPasswordValid = await this.passwordHasher.compare(input.password, user.password);
        if(!isPasswordValid){
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            ));
        }

        await this.userRepository.updateLastLogin(user.id);
        
        const token = this.tokenService.sign(user.id);

        return Result.ok({
            token,
            user: user.props
        });
    }
};