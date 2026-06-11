import type { Request, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export interface IScriptingJupyterProxyService {
    proxyHttpRequest(req: Request, res: Response): Promise<void>;
    isJupyterUpgradeRequest(request: IncomingMessage): boolean;
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void>;
}
