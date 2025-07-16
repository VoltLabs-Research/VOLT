import { Router } from 'express';
import multer from 'multer';
import * as controller from '@controllers/dislocations';

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

router.delete('/:folderId', controller.deleteFolder);
router.post('/', upload.array('files'), controller.uploadTrajectoryFiles);
router.get('/', controller.listTrajectories);
router.get('/:folderId', controller.getTrajectorySimulationInfo);
router.post('/:folderId/analyze', controller.analyzeTrajectory);

export default router;