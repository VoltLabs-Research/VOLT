/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { Router } from 'express';
import multer from 'multer';
import * as controller from '@controllers/trajectories';
import * as middleware from '@middlewares/trajectory';
import * as authMiddleware from '@middlewares/authentication';

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

router.use(authMiddleware.protect);

router.route('/')
    .get(controller.getUserTrajectories)
    .post(
        upload.array('trajectoryFiles'), 
        middleware.processAndValidateUpload,
        controller.createTrajectory
    );

router.get(
    '/:id/gltf/:timestep', 
    middleware.checkTrajectoryOwnership, 
    controller.getTrajectoryGLTF
);

router.route('/:id')
    .get(
        middleware.checkTrajectoryOwnership, 
        controller.getTrajectoryById
    )
    .patch(
        middleware.checkTrajectoryOwnership,
        controller.updateTrajectoryById
    )
    .delete(
        middleware.checkTrajectoryOwnership,
        controller.deleteTrajectoryById
    );

router.post(
    '/:id/share',
    middleware.checkTrajectoryOwnership,
    controller.shareTrajectoryWithUser
);

export default router;