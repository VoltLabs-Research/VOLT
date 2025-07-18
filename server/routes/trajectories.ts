import { Router } from 'express';
import multer from 'multer';
import * as controller from '@controllers/trajectories';
import * as middleware from '@middlewares/trajectory';

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

// TODO:
// router.use(protect);

router.route('/')
    .get(controller.getUserTrajectories)
    .post(
        upload.array('trajectoryFiles'), 
        middleware.processAndValidateUpload,
        controller.createTrajectory
    );

router.route('/:trajectoryId')
    .get(controller.getTrajectoryById)
    .delete(
        middleware.checkTrajectoryOwnership,
        controller.deleteTrajectoryById
    );

router.post(
    '/:trajectoryId/share',
    middleware.checkTrajectoryOwnership,
    controller.shareTrajectoryWithUser
);

export default router;