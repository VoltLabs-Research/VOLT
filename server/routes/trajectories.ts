import { Router } from 'express';
import multer from 'multer';
import * as controller from '@controllers/trajectories';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: process.env.MAX_FILE_SIZE,
        files: process.env.MAX_FILES
    },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

router.get('/', controller.listTrajectories);
router.delete('/:trajectoryId', controller.deleteTrajectory);
router.post('/', upload.array('files'), controller.uploadTrajectory);


export default router;