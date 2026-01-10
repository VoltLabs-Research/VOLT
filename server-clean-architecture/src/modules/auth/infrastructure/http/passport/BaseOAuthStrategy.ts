import { Request } from "express";
import OAuthLoginUseCase from "../../../application/use-cases/OAuthLoginUseCase";
import { OAuthProvider } from "../../../domain/entities/User";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { ErrorCodes } from "@/src/core/constants/error-codes";

export interface OAuthMappedProfile{
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
};

export interface OAuthProfileMapper{
    map(profile: any): OAuthMappedProfile;
};

export default abstract class BaseOAuthStrategy{
    constructor(
        protected readonly provider: OAuthProvider,
        protected readonly oauthLoginUseCase: OAuthLoginUseCase,
        protected readonly mapper: OAuthProfileMapper
    ){}

    protected async verify(req: AuthenticatedRequest, _accessToken: string, _refreshToken: string, profile: any, done: any){
        try{
            const mappedProfile = this.mapper.map(profile);
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            const result = await this.oauthLoginUseCase.execute({
                ...mappedProfile,
                oauthProvider: this.provider,
                oauthId: profile.id,
                ip,
                userAgent
            });

            if(!result.success){
                throw new Error(ErrorCodes.OAUTH_STRATEGY_ERROR);
            }

            const { user, token } = result.value;
            req.user = user;
            req.token = token;

            return done(null, user);
        }catch(error){
            return done(error, null);
        }
    }
};