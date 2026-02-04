import { ErrorCode } from '@/constants/error-codes';

class RuntimeError extends Error{
    statusCode: number;
    code: ErrorCode;

    constructor(code: ErrorCode, statusCode: number){
        super(code);
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
};

export default RuntimeError;
