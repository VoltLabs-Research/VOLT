import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (_req: any, _file: Express.Multer.File, cb: any) => {
    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter
});