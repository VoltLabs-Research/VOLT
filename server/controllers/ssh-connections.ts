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

import { Request, Response } from 'express';
import SSHConnection, { ISSHConnection } from '@/models/ssh-connection';
import RuntimeError from '@/utilities/runtime/runtime-error';
import SSHService from '@/services/ssh';
import logger from '@/logger';

export const getUserSSHConnections = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;

    try {
        const connections = await SSHConnection.find({ user: userId })
            .select('-encryptedPassword')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            status: 'success',
            data: {
                connections
            }
        });
    } catch (err: any) {
        logger.error(`Failed to fetch SSH connections: ${err.message}`);
        throw new RuntimeError('SSHConnection::FetchError', 500);
    }
};

export const createSSHConnection = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { name, host, port, username, password } = req.body;

    if (!name || !host || !username || !password) {
        throw new RuntimeError('SSHConnection::MissingFields', 400);
    }

    try {
        const connection = new SSHConnection({
            name,
            host,
            port: port || 22,
            username,
            user: userId
        });

        // Encrypt and set password
        connection.setPassword(password);

        await connection.save();

        // Return without password
        const connectionData = connection.toJSON();

        res.status(201).json({
            status: 'success',
            data: {
                connection: connectionData
            }
        });
    } catch (err: any) {
        if (err.message === 'SSHConnection::Name::Duplicate') {
            throw new RuntimeError('SSHConnection::Name::Duplicate', 400);
        }
        logger.error(`Failed to create SSH connection: ${err.message}`);
        throw new RuntimeError('SSHConnection::CreateError', 500);
    }
};

export const updateSSHConnection = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { id } = req.params;
    const { name, host, port, username, password } = req.body;

    try {
        const connection = await SSHConnection.findOne({
            _id: id,
            user: userId
        }).select('+encryptedPassword');

        if (!connection) {
            throw new RuntimeError('SSHConnection::NotFound', 404);
        }

        // Update fields
        if (name) connection.name = name;
        if (host) connection.host = host;
        if (port) connection.port = port;
        if (username) connection.username = username;
        if (password) connection.setPassword(password);

        await connection.save();

        // Return without password
        const connectionData = connection.toJSON();

        res.status(200).json({
            status: 'success',
            data: {
                connection: connectionData
            }
        });
    } catch (err: any) {
        if (err instanceof RuntimeError) {
            throw err;
        }
        logger.error(`Failed to update SSH connection: ${err.message}`);
        throw new RuntimeError('SSHConnection::UpdateError', 500);
    }
};

export const deleteSSHConnection = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { id } = req.params;

    try {
        const connection = await SSHConnection.findOneAndDelete({
            _id: id,
            user: userId
        });

        if (!connection) {
            throw new RuntimeError('SSHConnection::NotFound', 404);
        }

        res.status(200).json({
            status: 'success',
            data: null
        });
    } catch (err: any) {
        if (err instanceof RuntimeError) {
            throw err;
        }
        logger.error(`Failed to delete SSH connection: ${err.message}`);
        throw new RuntimeError('SSHConnection::DeleteError', 500);
    }
};

export const testSSHConnection = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { id } = req.params;

    try {
        const connection = await SSHConnection.findOne({
            _id: id,
            user: userId
        }).select('+encryptedPassword');

        if (!connection) {
            throw new RuntimeError('SSHConnection::NotFound', 404);
        }

        // Test the connection
        const isValid = await SSHService.testConnection(connection);

        res.status(200).json({
            status: 'success',
            data: {
                valid: isValid
            }
        });
    } catch (err: any) {
        if (err instanceof RuntimeError) {
            throw err;
        }
        logger.error(`SSH connection test failed: ${err.message}`);

        res.status(200).json({
            status: 'success',
            data: {
                valid: false,
                error: err.message
            }
        });
    }
};
