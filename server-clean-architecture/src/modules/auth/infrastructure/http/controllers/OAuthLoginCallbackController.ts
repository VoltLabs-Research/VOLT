import { Response } from 'express';
import { injectable } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

@injectable()
export default class OAuthLoginCallbackController{
    constructor(){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { token } = req;
        if(!token){
            res.redirect(`${process.env.OAUTH_FAILURE_REDIRECT || 'http://localhost:3000/auth/login?error=oauth_failed'}`);
            return;
        }

        const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/auth/oauth/success';
        res.redirect(`${frontendUrl}?token=${token}`);
    }
};