import net from 'node:net';

const listenOn = (port: number): Promise<number> => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen({
        port,
        host: '127.0.0.1'
    }, () => {
        const address = server.address();
        const bound = typeof address === 'object' && address ? address.port : port;
        server.close(() => resolve(bound));
    });
});

export const findFreePort = async (preferred: number): Promise<number> => {
    try{
        return await listenOn(preferred);
    }catch{
        return listenOn(0);
    }
};
