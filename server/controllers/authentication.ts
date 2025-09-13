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
import { User } from '@models/index';
import jwt from 'jsonwebtoken';

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

const withAuthenticatedUser = (options: any = {}) => ({
    ...options,
    customFilter: async (req: Request) => {
        const userId = (req as any).user.id;
        req.params.id = userId;
        return {};
    }
});

export const getMyAccount = userFactory.getOne(withAuthenticatedUser());

export const updateMyAccount = userFactory.updateOne(
    withAuthenticatedUser({
        beforeUpdate: async (data: any, req: Request, doc: IUser) => {
            console.log(`Updating user: ${doc.email}`);
            return data;
        }
    })
);

export const deleteMyAccount = userFactory.deleteOne(
    withAuthenticatedUser({
        beforeDelete: async (doc: IUser, req: Request) => {
            console.log(`Deleting user account: ${doc.email}`);
        }
    })
);

const signToken = (id: string): string => {
    return jwt.sign({ id }, process.env.SECRET_KEY!, {
        expiresIn: process.env.JWT_EXPIRATION_DAYS!
    });
};

const createAndSendToken = (res: Response, statusCode: number, user: IUser): void => {
    const token = signToken(user._id as string);
    (user as any).password = undefined;
    (user as any).__v = undefined;
    res.status(statusCode).json({
        status: 'success',
        data: { token, user }
    });
};

export const signIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body;
    if(!email || !password){
        return next(new Error('Missing email or password'));
    }
    const requestedUser = await User.findOne({ email }).select('+password');
    if(!requestedUser || !(await requestedUser.isCorrectPassword(password, requestedUser.password))){
        return next(new Error('Email or password are incorrect'));
    }
    createAndSendToken(res, 200, requestedUser);
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
    const { email, firstName, lastName, password } = req.body;
    const newUser = await User.create({ email, firstName, lastName, password });
    createAndSendToken(res, 201, newUser);
};

export const updateMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user as IUser;
    const requestedUser = await User.findById(user.id).select('+password');
    if(!requestedUser){
        return next(new Error('Authentication::Update::UserNotFound'));
    }
    if(!(await requestedUser.isCorrectPassword(req.body.passwordCurrent, requestedUser.password))){
        return next(new Error('Authentication::Update::PasswordCurrentIncorrect'));
    }
    if(await requestedUser.isCorrectPassword(req.body.passwordConfirm, requestedUser.password)){
        return next(new Error('Authentication::Update::PasswordsAreSame'));
    }
    requestedUser.password = req.body.password;
    await requestedUser.save();
    createAndSendToken(res, 200, requestedUser);
};