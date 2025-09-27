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

import http from 'http';
import app from '@config/express';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import SocketGateway from '@/socket/socket-gateway';
import JobsModule from '@/socket/modules/jobs';
import CursorModule from '@/socket/modules/cursor';
import TrajectoryModule from '@/socket/modules/trajectory';
import ChatModule from '@/socket/modules/chat';
import { initializeRedis } from '@config/redis';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

const server = http.createServer(app);
const gateway = new SocketGateway()
    .register(new JobsModule())
    .register(new CursorModule())
    .register(new TrajectoryModule())
    .register(new ChatModule());

const shutodwn = async () => {
    await gateway.close();
    process.exit(0);
};

server.listen(SERVER_PORT as number, SERVER_HOST, async () => {
    await gateway.initialize(server);

    initializeRedis();
    await mongoConnector();
    console.log(`Server running at http://${SERVER_HOST}:${SERVER_PORT}/`);

    process.on('SIGTERM', shutodwn);
    process.on('SIGINT', shutodwn);
});