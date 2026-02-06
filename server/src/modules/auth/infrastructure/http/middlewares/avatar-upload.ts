import multer from 'multer';

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        // 5 MB
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if(file.mimetype.startsWith('image/')){
            cb(null, true);
        }else{
            cb(null, false);
        }
    }
});

export default avatarUpload;