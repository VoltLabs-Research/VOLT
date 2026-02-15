import multer from 'multer';
import path from 'node:path';

const storage = multer.memoryStorage();

const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.dll', '.so'];

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (dangerousExtensions.includes(ext)) {
        return cb(new Error('File type not allowed'));
    }
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024, files: 10 }
});
