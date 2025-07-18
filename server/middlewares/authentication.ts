import jwt from 'jsonwebtoken';
import User from '@models/user';
import RuntimeError from '@utilities/runtimeError';
import { promisify } from 'util';
import { Request, Response, NextFunction, RequestHandler } from 'express';

interface DecodedToken extends JwtPayload{
    id: string;
    iat: number;
}

/**
 * Extracts and verifies a JWT token from the Authorization header, then retrieves
 * the corresponding user.
 *
 * @param {string} token - The JWT token to verify and decode.
 * @returns {Promise<object>} - The user object if found, otherwise throws an error.
 * @throws {RuntimeError} - If the user is not found or password has changed after 
 *                          the token was issued.
*/
export const getUserByToken = async (token: string, next: NextFunction): Promise<object | undefined> => {
    const decodedToken = await promisify(jwt.verify)(token, process.env.SECRET_KEY as string);
    // Retrieve the user from the database
    const freshUser = await User.findById(decodedToken.id).select('-devices -__v');
    if(!freshUser){
        next(new RuntimeError('Authentication::User::NotFound', 401));
        return;
    }
    // Check if the user's password has changed since the token was issued
    if(await freshUser.isPasswordChangedAfterJWFWasIssued(decodedToken.iat)){
        next(new RuntimeError('Authentication::PasswordChanged', 401));
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
export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }else{
        return next(new RuntimeError('Authentication::Required', 401));
    }
    const freshUser = await getUserByToken(token, next);
    req.user = freshUser;
    next();
};

/**
 * Authorization middleware to restrict access based on user roles.
 *
 * @param {...string} roles - The allowed roles for the route.
 * @returns {RequestHandler} - Express middleware function.
*/
export const restrictTo = (...roles: string[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Check if the user role matches any allowed roles
        if(!roles.includes(req.user.role)){
            return next(new RuntimeError('Authentication::Unauthorized', 403));
        }
        next();
    };
};
