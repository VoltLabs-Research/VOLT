/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { catchAsync } from '@/utilities/runtime/runtime';

export default class PasswordController {
    public changePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user._id;
            const { currentPassword, newPassword, confirmPassword } = req.body;

            if (!currentPassword || !newPassword || !confirmPassword) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_VALIDATION_MISSING_FIELDS, 400));
            }

            if (newPassword !== confirmPassword) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_VALIDATION_MISMATCH, 400));
            }

            if (newPassword.length < 8) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_VALIDATION_TOO_SHORT, 400));
            }

            const user = await User.findById(userId).select('+password');
            if (!user) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_USER_NOT_FOUND, 404));
            }

            if (!(await user.isCorrectPassword(currentPassword, user.password))) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_CURRENT_INCORRECT, 400));
            }

            if (await user.isCorrectPassword(newPassword, user.password)) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_SAME_AS_CURRENT, 400));
            }

            user.password = newPassword;
            await user.save();

            res.status(200).json({ status: 'success', message: 'Password changed successfully' });
        } catch (error) {
            next(new RuntimeError(ErrorCodes.PASSWORD_CHANGE_FAILED, 500));
        }
    });

    public getPasswordInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user._id;
            const user = await User.findById(userId).select('passwordChangedAt');
            if (!user) {
                return next(new RuntimeError(ErrorCodes.PASSWORD_USER_NOT_FOUND, 404));
            }

            res.status(200).json({
                status: 'success',
                data: {
                    lastChanged: user.passwordChangedAt || user.createdAt || new Date(),
                    hasPassword: !!user.password
                }
            });
        } catch (error) {
            next(new RuntimeError(ErrorCodes.PASSWORD_GET_INFO_FAILED, 500));
        }
    });
}
