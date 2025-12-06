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
import SSHConnection from '@/models/ssh-connection';
import RuntimeError from '@/utilities/runtime/runtime-error';

/**
 * Middleware to load and verify SSH connection ownership
 * Loads the connection with encrypted password and stores it in res.locals.sshConnection
 */
export const loadAndVerifySSHConnection = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const { id, connectionId } = req.params;
    const queryConnectionId = req.query.connectionId as string;
    const bodyConnectionId = req.body.connectionId;
    
    const actualConnectionId = id || connectionId || queryConnectionId || bodyConnectionId;

    if (!actualConnectionId) {
        return next(new RuntimeError('SSH::ConnectionId::Required', 400));
    }

    try {
        const connection = await SSHConnection.findOne({
            _id: actualConnectionId,
            user: user._id || user.id
        }).select('+encryptedPassword');

        if (!connection) {
            return next(new RuntimeError('SSHConnection::NotFound', 404));
        }

        res.locals.sshConnection = connection;
        next();
    } catch (err: any) {
        return next(new RuntimeError('SSHConnection::LoadError', 500));
    }
};

/**
 * Middleware to validate required SSH connection fields
 */
export const validateSSHConnectionFields = (req: Request, res: Response, next: NextFunction) => {
    const { name, host, username, password } = req.body;

    if (!name || !host || !username || !password) {
        return next(new RuntimeError('SSHConnection::MissingFields', 400));
    }

    next();
};

/**
 * Middleware to validate SSH import required fields
 */
export const validateSSHImportFields = (req: Request, res: Response, next: NextFunction) => {
    const { connectionId, remotePath, teamId } = req.body;

    if (!connectionId || !remotePath || !teamId) {
        return next(new RuntimeError('SSH::Import::MissingFields', 400));
    }

    next();
};
