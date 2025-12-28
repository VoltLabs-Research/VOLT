import { Request, Response } from 'express';
import SSHConnection, { ISSHConnection } from '@/models/ssh-connection';
import SSHService from '@/services/ssh';
import { catchAsync } from '@/utilities/runtime/runtime';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/permissions';
import { FilterQuery } from 'mongoose';

export default class SSHConnectionsController extends BaseController<ISSHConnection> {
    constructor() {
        super(SSHConnection, {
            resource: Resource.SSH_CONNECTION,
            resourceName: 'SSHConnection',
            fields: ['name', 'host', 'port', 'username']
        });
    }

    /**
     * Scope to current user only
     */
    protected async getFilter(req: Request): Promise<FilterQuery<ISSHConnection>> {
        const userId = (req as any).user._id || (req as any).user.id;
        return { user: userId };
    }

    /**
     * Custom create to handle password encryption
     */
    protected async create(data: Partial<ISSHConnection>, req: Request): Promise<ISSHConnection> {
        const userId = (req as any).user._id || (req as any).user.id;
        const { password } = req.body;

        const connection = new SSHConnection({
            ...data,
            port: data.port || 22,
            user: userId
        });

        if (password) {
            connection.setPassword(password);
        }

        await connection.save();
        return connection;
    }

    /**
     * Handle password encryption on update
     */
    protected async onBeforeUpdate(
        data: Partial<ISSHConnection>,
        req: Request,
        currentDoc: ISSHConnection
    ): Promise<Partial<ISSHConnection>> {
        const { password } = req.body;

        // If password provided, encrypt it and set on the document
        if (password) {
            currentDoc.setPassword(password);
            await currentDoc.save();
        }

        return data;
    }

    /**
     * Test SSH connection - specialized action, not CRUD
     */
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
