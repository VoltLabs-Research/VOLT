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
