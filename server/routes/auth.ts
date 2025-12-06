/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import express from 'express';
import AuthController from '@controllers/authentication';
import * as middleware from '@middlewares/authentication';
import passport from '@config/passport';
import multer from 'multer';

const router = express.Router();
const controller = new AuthController();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

router.post('/sign-in', controller.signIn);
router.post('/sign-up', controller.signUp);
router.post('/check-email', controller.checkEmail);

// OAuth routes
router.get('/github', passport.authenticate('github', { session: false, scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/auth/error' }), controller.oauthCallback);

router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }), controller.oauthCallback);

router.get('/microsoft', passport.authenticate('microsoft', { session: false, scope: ['user.read'] }));
router.get('/microsoft/callback', passport.authenticate('microsoft', { session: false, failureRedirect: '/auth/error' }), controller.oauthCallback);

router.use(middleware.protect);
router.patch('/me/update/password/', controller.updatePassword);

router.get('/me', controller.getMyAccount); // Changed from chained route to direct GET
router.get('/guest-identity', controller.getGuestIdentity); // Added new route

router.route('/me') // The chained route for /me now only handles PATCH and DELETE
    .patch(controller.updateMyAccount)
    .delete(controller.deleteMyAccount);

export default router;