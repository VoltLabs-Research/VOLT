import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import { SignUpInputDTO, SignUpOutputDTO } from "../../dtos/user/SignUpDTO";
import { IUserRepository } from "../../../domain/ports/IUserRepository";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { IPasswordHasher } from "../../../domain/ports/IPasswordHasher";
import { ITokenService } from "../../../domain/ports/ITokenService";
import validator from 'validator';
import { ErrorCodes } from "../../../../../core/constants/error-codes";
import { UserRole } from "../../../domain/entities/User";
import { SessionActivityType } from "../../../domain/entities/Session";
import { ISessionRepository } from "../../../domain/ports/ISessionRepository";

export default class SignUpUseCase implements IUseCase<SignUpInputDTO, SignUpOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService,
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: SignUpInputDTO): Promise<Result<SignUpOutputDTO, ApplicationError>>{
        /**
         * Validate email.
         */
        if(!validator.isEmail(input.email)){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTH_CREDENTIALS_INVALID, 
                'Invalid email format'
            ));
        }

        /**
         * Check if email already exists.
         */
        const emailExists = await this.userRepository.emailExists(input.email);
        if(emailExists){
            return Result.fail(ApplicationError.conflict(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Email already registered'
            ));
        }

        /**
         * Validate password.
         */
        if(!input.password){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTH_CREDENTIALS_MISSING,
                'Missing password'
            ));
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);

        const newUser = await this.userRepository.create({
            email: input.email,
            firstName: input.firstName.toLowerCase().trim(),
            lastName: input.lastName.toLowerCase().trim(),
            password: hashedPassword,
            role: UserRole.User,
            teams: [],
            analyses: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const token = this.tokenService.sign(newUser.id);

        await this.sessionRepository.create({
            user: newUser.id,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: SessionActivityType.Login,
            success: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        return Result.ok({
            token,
            user: newUser.props
        });
    }
};