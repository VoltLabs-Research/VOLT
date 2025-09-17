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
        // TODO: from env?
        fileSize: process.env.MAX_FILE_SIZE,
        files: process.env.MAX_FILES
    },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    }
});

const previewUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if(file.mimetype.startsWith('image/')){
            cb(null, true);
        }else{
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Rutas que requieren autenticación completa
router.route('/')
    .get(
        authMiddleware.protect,
        controller.getUserTrajectories
    )
    .post(
        authMiddleware.protect,
        upload.array('trajectoryFiles'), 
        middleware.processAndValidateUpload,
        controller.createTrajectory
    );

// Rutas que permiten acceso público si la trayectoria es pública
router.get(
    '/:id/glb/:timestep/:analysisId', 
    authMiddleware.optionalAuth,
    middleware.checkTeamMembershipForTrajectory, 
    controller.getTrajectoryGLB
);

router.get(
    '/metrics/:id',
    middleware.checkTeamMembershipForTrajectory, 
    controller.getMetrics
)

router.get(
    '/metrics',
    controller.getTrajectoryMetrics
);

router.get(
    '/:id/preview',
    authMiddleware.optionalAuth,
    middleware.checkTeamMembershipForTrajectory,
    controller.getTrajectoryPreview
);

router.get(
    '/:id/glb/',
    authMiddleware.optionalAuth,
    middleware.checkTeamMembershipForTrajectory,
    controller.listTrajectoryGLBFiles
);

router.route('/:id')
    .get(
        authMiddleware.optionalAuth,
        middleware.checkTeamMembershipForTrajectory, 
        controller.getTrajectoryById
    )
    .patch(
        authMiddleware.protect,
        middleware.checkTeamMembershipForTrajectory,
        previewUpload.single('preview'),
        middleware.processPreviewUpload,
        controller.updateTrajectoryById
    )
    .delete(
        authMiddleware.protect,
        middleware.checkTeamMembershipForTrajectory,
        controller.deleteTrajectoryById
    );

export default router;