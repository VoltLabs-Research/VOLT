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

import { Request, Response } from 'express';
import SSHConnection from '@/models/ssh-connection';
import SSHService from '@/services/ssh';
import { catchAsync } from '@/utilities/runtime/runtime';

export default class SSHConnectionsController {
    public getUserSSHConnections = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id || (req as any).user.id;
        const connections = await SSHConnection.find({ user: userId })
            .select('-encryptedPassword')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ status: 'success', data: { connections } });
    });

    public createSSHConnection = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id || (req as any).user.id;
        const { name, host, port, username, password } = req.body;

        const connection = new SSHConnection({
            name,
            host,
            port: port || 22,
            username,
            user: userId
        });
        connection.setPassword(password);
        await connection.save();

        res.status(201).json({ status: 'success', data: { connection: connection.toJSON() } });
    });

    public updateSSHConnection = catchAsync(async (req: Request, res: Response) => {
        const { name, host, port, username, password } = req.body;
        const connection = res.locals.sshConnection;

        if (name) connection.name = name;
        if (host) connection.host = host;
        if (port) connection.port = port;
        if (username) connection.username = username;
        if (password) connection.setPassword(password);

        await connection.save();
        res.status(200).json({ status: 'success', data: { connection: connection.toJSON() } });
    });

    public deleteSSHConnection = catchAsync(async (req: Request, res: Response) => {
        const connection = res.locals.sshConnection;
        await connection.deleteOne();
        res.status(204).json({ status: 'success', data: null });
    });

    public testSSHConnection = catchAsync(async (req: Request, res: Response) => {
        const connection = res.locals.sshConnection;
        try {
            const isValid = await SSHService.testConnection(connection);
            res.status(200).json({ status: 'success', data: { valid: isValid } });
        } catch (err: any) {
            res.status(200).json({ status: 'success', data: { valid: false, error: err.message } });
        }
    });
}
