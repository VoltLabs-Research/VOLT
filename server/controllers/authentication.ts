/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Request, Response, NextFunction } from 'express';
import { IUser } from '@/types/models/user';
import HandlerFactory from '@/controllers/handler-factory';
import { User, Session } from '@models/index';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import RuntimeError from '@/utilities/runtime-error';

const userFactory = new HandlerFactory({
    model: User,
    fields: ['firstName', 'lastName', 'email'],
    errorMessages: {
        default: {
            notFound: 'Authentication::User::NotFound',
            validation: 'Authentication::User::ValidationError',
            unauthorized: 'Authentication::User::AccessDenied'
        }
    },
    defaultErrorConfig: 'default'
});

/**
 * Augments handler options to constrain actions to the currently authenticated user.
 * 
 * @param options - Optional handler configuration (e.g. `beforeUpdate`, `beforeDelete`).
 * @returns A new options object that injects a `customFilter` binding the action to `req.user.id`.
 * 
 * @remarks
 * - Requires an upstream authentication middleware that sets `req.user` with an `id` property.
 * - Sets `req.params.id` so downstream factory handlers act on the authenticated user's document.
 * 
 * @public
 */
const withAuthenticatedUser = (options: any = {}) => ({
    ...options,
    customFilter: async (req: Request) => {
        const userId = (req as any).user.id;
        req.params.id = userId;
        return {};
    }
});

/**
 * Get the authenticated user's account (profile) document.
 * 
 * @remarks
 * Delegates to `HandlerFactory#getOne`, automatically scoping to `req.user.id`.
 * 
 * @public
 */
export const getMyAccount = userFactory.getOne(withAuthenticatedUser());

/**
 * Update the authenticated user's account with allowed fields.
 * 
 * @remarks
 * Allowed fields are defined in the factory: `firstName`, `lastName`, `email`.
 * Includes a `beforeUpdate` hook example that logs the target user's email.
 * 
 * @public
 */
export const updateMyAccount = userFactory.updateOne(
    withAuthenticatedUser({
        beforeUpdate: async (data: any, req: Request, doc: IUser) => {
            return data;
        }
    })
);

/**
 * Delete the authenticated user's account.
 * 
 * @public
 */
export const deleteMyAccount = userFactory.deleteOne();

/**
 * Sign a JWT for a given user identifier.
 * 
 * @param id - The user's unique identifier (MongoDB ObjectId as string).
 * @returns A signed JSON Web Token.
 * 
 * @throws If `process.env.SECRET_KEY` or `process.env.JWT_EXPIRATION_DAYS` is not defined.
 * 
 * @remarks
 * - Uses `SECRET_KEY` to sign and `JWT_EXPIRATION_DAYS` for expiration (e.g, `"7d"`).
 * - The token payload is `{ id }`.
 * 
 * @see {@link createAndSendToken} for emitting the token in a standard HTTP response.
 * 
 * @public
 */
const signToken = (id: string): string => {
    const secret: Secret = process.env.SECRET_KEY as Secret;
    const raw = process.env.JWT_EXPIRATION_DAYS;
    const expiresIn = raw && /^\d+$/.test(raw) ? Number(raw) : (raw || '7d');
    return jwt.sign({ id }, secret, { expiresIn: expiresIn as any });
};

/**
 * Create a JWT for the provided user and send the canonical success response.
 * 
 * @param res - Express response object.
 * @param statusCode - HTTP status code to use (e.g., 200, 201).
 * @param user - The authenticated or newly created user document.
 * @param req - Express request object for session tracking.
 * @returns `void`
 * 
 * @remarks
 * - Removes sensitive properties (`password`, `__v`) from the serialized user
 * - Creates a session record for the user
 * 
 * @public
 */
const createAndSendToken = async (res: Response, statusCode: number, user: IUser, req: Request): Promise<void> => {
    const token = signToken(String(user._id));

    // Create session record
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    await Session.create({
        user: user._id,
        token,
        userAgent,
        ip,
        isActive: true,
        lastActivity: new Date(),
        action: 'login',
        success: true
    });

    (user as any).password = undefined;
    (user as any).__v = undefined;
    res.status(statusCode).json({
        status: 'success',
        data: { token, user }
    });
};

/**
 * Sign in a user with email and password.
 * 
 * @param req - Express request containing `email` and `password` in the body.
 * @param res  - Express response used to send the signed JWT and user data.
 * @param next - Express next function to propagate errors.
 * @returns A Promise that resolves when the response has been sent.
 * 
 * @throws Propagates errors via `next()` in the following cases:
 * - Missing credentials (`email` or `password` not provided).
 * - User not found or password mismatch.
 * 
 * @remarks
 * - On success, responds with a `200` status and a `{ token, user }` payload via {@link createAndSendToken}.
 * 
 * @public
 */
export const signIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    if (!email || !password) {
        return next(new RuntimeError('Auth::Credentials::Missing', 400));
    }

    const requestedUser = await User.findOne({ email }).select('+password');
    if (!requestedUser || (requestedUser.password && !(await requestedUser.isCorrectPassword(password, requestedUser.password)))) {
        // Track failed login attempt
        await Session.create({
            user: requestedUser?._id || null,
            token: null, // No token for failed logins
            userAgent,
            ip,
            isActive: false,
            lastActivity: new Date(),
            action: 'failed_login',
            success: false,
            failureReason: !requestedUser ? 'User not found' : 'Invalid password'
        });

        return next(new RuntimeError('Auth::Credentials::Invalid', 401));
    }

    await createAndSendToken(res, 200, requestedUser, req);
};

/**
 * Register a new user account and return a signed JWT.
 * 
 * @param req - Express request containing `email`, `firstName`, `lastName`, and `password` in the body.
 * @param res - Express response used to send the signed JWT and user data.
 * @returns A Promise that resolves when the response has been sent.
 * 
 * @throws Propagates validation or persistence errors thrown by the `User` model.
 * 
 * @remarks
 * - On success, responds with a `201` status and a `{ token, user }` payload via {@link createAndSendToken}.
 */
export const signUp = async (req: Request, res: Response): Promise<void> => {
    const { email, firstName, lastName, password } = req.body;
    const newUser = await User.create({ email, firstName, lastName, password });
    await createAndSendToken(res, 201, newUser, req);
};

/**
 * Check if an email is already registered.
 * 
 * @param req - Express request containing `email` in the body.
 * @param res - Express response used to send the existence status.
 * @returns A Promise that resolves when the response has been sent.
 */
export const checkEmailExistence = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    res.status(200).json({
        status: 'success',
        data: { exists: !!user }
    });
};

const filterObj = (obj: any, ...allowedFields: string[]) => {
    const newObj: any = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};

/**
 * Update the authenticated user's own profile data.
 * 
 * @param req - Express request containing `req.user` (from auth middleware) and update fields in `body`.
 * @param res - Express response used to send the updated user data.
 * @param next - Express next function to propagate errors.
 * @returns A Promise that resolves when the response has been sent.
 * 
 * @remarks
 * - Allows updating `firstName`, `lastName`, `email`, and `avatar`.
 * - Filters out other fields to prevent unauthorized updates.
 * - Handles avatar file upload if `req.file` is present.
 * 
 * @public
 */
export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1) Ensure user is authenticated
    if (!req.user) {
        return next(new RuntimeError('Authentication::User::NotFound', 401));
    }

    // 2) Filtered out unwanted fields names that are not allowed to be updated
    const filteredBody = filterObj(req.body, 'firstName', 'lastName', 'email');

    // Handle avatar upload
    if (req.file) {
        try {
            const { AvatarService } = await import('@services/avatar');
            const avatarUrl = await AvatarService.uploadCustomAvatar(
                (req.user as any)._id.toString(),
                req.file.buffer,
                req.file.mimetype
            );
            filteredBody.avatar = avatarUrl;
        } catch (error) {
            return next(new RuntimeError('Authentication::Update::AvatarUploadFailed', 500));
        }
    }

    // 3) Update user document
    const updatedUser = await User.findByIdAndUpdate((req.user as any)._id, filteredBody, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        status: 'success',
        data: {
            user: updatedUser
        }
    });
};

export const getGuestIdentity = (req: Request, res: Response, next: NextFunction) => {
    const { seed } = req.query;
    if (!seed || typeof seed !== 'string') {
        return next(new RuntimeError('Authentication::Guest::SeedRequired', 400));
    }

    const { generateRandomName } = require('@utilities/name-generator');
    const { firstName, lastName } = generateRandomName(seed);

    res.status(200).json({
        status: 'success',
        data: {
            firstName,
            lastName
        }
    });
};

/**
 * Update the authenticated user's password after validating the current password.
 * 
 * @deprecated Use the dedicated password controller instead
 * @param req - Express request containing:
 * - `req.user` (populated by auth middleware)
 * - `body.passwordCurrent` (current password)
 * - `body.password` (new password)
 * - `body.passwordConfirm` (confirmation of new pasword)
 * @param res - Express response used to send the signed JWT and user data.
 * @param next - Express next function to propagate errors.
 * @returns A Promise that resolves when the response has been sent.
 * 
 * @throws Propagates errors via `next()` in the following cases:
 * - User document not found for `req.user.id`.
 * - `passwordCurrent` is incorrect.
 * - New password matches the existing password (`passwordConfirm` equals current hashed password).
 * 
 * @remarks
 * - Loads the user with `+password`, verifies the current password via `isCorrectPassword`, and saves the new password.
 * - On success, responds with a `200` status and a new `{ token, user }` via {@link createAndSendToken}.
 * 
 * @public
 */
export const updateMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user as IUser;
    const requestedUser = await User.findById(user.id).select('+password');
    if (!requestedUser) {
        return next(new RuntimeError('Authentication::Update::UserNotFound', 404));
    }
    if (!(await requestedUser.isCorrectPassword(req.body.passwordCurrent, requestedUser.password!))) {
        return next(new RuntimeError('Authentication::Update::PasswordCurrentIncorrect', 400));
    }
    if (await requestedUser.isCorrectPassword(req.body.passwordConfirm, requestedUser.password!)) {
        return next(new RuntimeError('Authentication::Update::PasswordsAreSame', 400));
    }
    requestedUser.password = req.body.password;
    await requestedUser.save();
    await createAndSendToken(res, 200, requestedUser, req);
};

/**
 * Handle OAuth callback from providers (GitHub, Google, Microsoft)
 * 
 * @param req - Express request with authenticated user from Passport
 * @param res - Express response to redirect with token
 * @returns A Promise that redirects to frontend with JWT token
 * 
 * @remarks
 * - User is already authenticated by Passport strategy
 * - Generates JWT and redirects to frontend success page with token in query
 * 
 * @public
 */
export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser;
    const token = signToken(String(user._id));

    // Create session record
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    await Session.create({
        user: user._id,
        token,
        userAgent,
        ip,
        isActive: true,
        lastActivity: new Date(),
        action: 'oauth_login',
        success: true
    });

    // Redirect to frontend with token
    const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/auth/oauth/success';
    res.redirect(`${frontendUrl}?token=${token}`);
};