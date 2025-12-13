/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { User, Session } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import logger from '@/logger';

/**
 * Extracts and verifies a JWT token from the Authorization header, then retrieves
 * the corresponding user.
 *
 * @param {string} token - The JWT token to verify and decode.
 * @returns {Promise<object>} - The user object if found, otherwise throws an error.
 * @throws {RuntimeError} - If the user is not found or password has changed after
 *                          the token was issued.
*/
export const getUserByToken = async(token: string, next: NextFunction): Promise<any | undefined> =>{
    const secret = process.env.SECRET_KEY as string;
    const decodedToken = jwt.verify(token, secret) as any;
    // Retrieve the user from the database
    const freshUser = await User.findById(decodedToken.id).select('-devices -__v');
    if(!freshUser){
        next(new RuntimeError(ErrorCodes.AUTHENTICATION_USER_NOT_FOUND, 401));
        return;
    }
    // Check if the user's password has changed since the token was issued
    if(await freshUser.isPasswordChangedAfterJWFWasIssued(decodedToken.iat)) {
        next(new RuntimeError(ErrorCodes.AUTHENTICATION_PASSWORD_CHANGED, 401));
        return;
    }
    return freshUser;
};

/**
 * Express middleware to protect routes. Fetches and validates a JWT token.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - Express next function to continue.
 * @throws {RuntimeError} - If no token provided or if authentication fails.
*/
export const protect = async(req: Request, res: Response, next: NextFunction) => {
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }else{
        return next(new RuntimeError(ErrorCodes.AUTHENTICATION_REQUIRED, 401));
    }

    // Check if session is active
    const session = await Session.findOne({ token, isActive: true });
    if(!session){
        return next(new RuntimeError(ErrorCodes.AUTHENTICATION_SESSION_INVALID, 401));
    }

    const freshUser = await getUserByToken(token, next);
    (req as any).user = freshUser;

    // Update last activity
    await Session.findByIdAndUpdate(session._id, { lastActivity: new Date() });

    next();
};

/**
 * Express middleware to intentar autenticar al usuario, pero continuar si no está autenticado.
 * Útil para rutas que permiten acceso público pero tienen funcionalidades adicionales para usuarios autenticados.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - Express next function to continue.
*/
export const optionalAuth = async(req: Request, res: Response, next: NextFunction) => {
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        try{
            const freshUser = await getUserByToken(token, next);
            (req as any).user = freshUser;
        }catch(error){
            // Si hay error en la autenticación, simplemente continuamos sin usuario
            logger.info(`Optional authentication failed: ${error}`);
        }
    }
    next();
};

/**
 * Authorization middleware to restrict access based on user roles.
 *
 * @param {...string} roles - The allowed roles for the route.
 * @returns {RequestHandler} - Express middleware function.
*/
export const restrictTo = (...roles: string[]): RequestHandler => {
    return(req: Request, res: Response, next: NextFunction) => {
        // Check if the user role matches any allowed roles
        if(!roles.includes((req as any).user.role)) {
            return next(new RuntimeError(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 403));
        }
        next();
    };
};
