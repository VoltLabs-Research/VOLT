/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { Router } from 'express';
import TrajectoryController from '@controllers/trajectories';
import multer, { FileFilterCallback } from 'multer';
import * as middleware from '@middlewares/trajectory';
import * as authMiddleware from '@middlewares/authentication';

const router = Router();
const controller = new TrajectoryController();

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, require('os').tmpdir());
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        }
    }),
    fileFilter: (req, file, cb: FileFilterCallback) => {
        cb(null, true);
    }
});

router.use(authMiddleware.protect);

router.get(
    '/metrics',
    controller.getTeamMetrics
);

router.get(
    '/metrics/:id',
    middleware.checkTeamMembershipForTrajectory,
    controller.getSingleMetrics
)

router.route('/')
    .get(controller.getAll)
    .post(
        upload.array('trajectoryFiles'), 
        middleware.processAndValidateUpload, 
        controller.createOne
    );

router.get(
    '/:id/analysis/:analysisId',
    middleware.checkTeamMembershipForTrajectory,
    controller.getAtoms
);

router.route('/:id')
    .patch(
        middleware.requireTeamMembershipForTrajectory,
        controller.updateOne
    )
    .delete(
        middleware.requireTeamMembershipForTrajectory,
        controller.deleteOne
    );

router.use(authMiddleware.optionalAuth);
router.get(
    '/:id/:timestep/:analysisId',
    middleware.checkTeamMembershipForTrajectory,
    controller.getGLB
);

router.get(
    '/:id/preview',
    middleware.checkTeamMembershipForTrajectory,
    controller.getPreview
);

router.get(
    '/:id/glb-archive',
    middleware.checkTeamMembershipForTrajectory,
    controller.downloadGLBArchive
);

router.get(
    '/:id/',
    middleware.checkTeamMembershipForTrajectory,
    controller.getOne
);

export default router;
export const opts = { requiresTeamId: true };