import { Request } from 'express';

const getUserAgent = (req: Request): string => {
    return req.headers['user-agent'] || '';
};

export default getUserAgent;