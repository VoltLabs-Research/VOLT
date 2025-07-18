import { Request, Responset, NextFunction, request } from 'express';
import { IUser } from '@types/models/user';
import { filterObject } from '@utilities/runtime';
import User from '@models/user';
import jwt from 'jsonwebtoken';

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

export const signUp = async (req: Request, res: Responset): Promise<void> => {
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

export const deleteMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestedUser = await User.findByIdAndDelete((req.user as IUser).id);
    if(!requestedUser) return next(new Error('Authentication::Delete::UserNotFound'));
    res.status(204).json({
        status: 'success',
        data: requestedUser
    });
};

export const getMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestedUser = await User.findById((req.user as IUser)._id);
    if(!requestedUser) return next(new Error('Authentication::Get::UserNotFound'));
    res.status(200).json({
        status: 'success',
        data: requestedUser
    });
};

export const updateMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const filteredBody = filterObject(req.body, 'lastName', 'firstName', 'email');
    const requestedUser = await User.findByIdAndUpdate((req.user as IUser).id, filteredBody, {
        new: true,
        runValidators: true
    });
    if(!requestedUser) return next(new Error('Authentication::Update::UserNotFound'));
    res.status(200).json({
        status: 'success',
        data: requestedUser
    });
};