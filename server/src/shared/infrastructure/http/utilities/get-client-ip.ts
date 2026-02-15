import { Request } from 'express';

const getClientIP = (req: Request): string => {
    // WARNING: X-Forwarded-For can be spoofed. Only trust when behind a known proxy.
    const xForwardedFor = req.headers['x-forwarded-for'];
    if(xForwardedFor){
        const ipAdress = typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0];
        return ipAdress.split(',')[0].trim();
    }

    return req.socket.remoteAddress || req.ip || '';
};

export default getClientIP;