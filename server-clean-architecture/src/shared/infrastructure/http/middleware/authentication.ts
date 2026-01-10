import { ErrorCodes } from "@/src/core/constants/error-codes";
import { NextFunction, Request, Response } from "express";
import authContainer from '@/src/modules/auth/infrastructure/di/container';
import UserRepository from "@/src/modules/auth/infrastructure/persistence/mongo/repositories/UserRepository";
import jwt from 'jsonwebtoken';

const userRepository = authContainer.resolve(UserRepository);

export interface AuthenticatedRequest extends Request{
    user?: any;
    userId?: string;
    sessionId?: string;
    token?: string;
};

export const protect = async (
    req: AuthenticatedRequest,
    res: Response, 
    next: NextFunction
): Promise<void> => {
    let token: string | undefined;

    if(req.headers.authorization?.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }

    if(!token){
        res.status(401).json({
            status: 'error',
            message: ErrorCodes.AUTHENTICATION_REQUIRED
        });
        return;
    }

    /**
     * Token and user verification.
     */
    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as any;
    const user = await userRepository.findById(decoded.id);
    if(!user){
        res.status(401).json({
            status: 'error',
            message: ErrorCodes.USER_NOT_FOUND
        });
        return;
    }


    req.user = user;
    req.userId = user.id;
    req.token = token;

    next();
};