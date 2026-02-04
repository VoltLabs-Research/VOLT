import express from 'express';
import AuthController from '@/controllers/auth/authentication';
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
        if(file.mimetype.startsWith('image/')) {
            cb(null, true);
        }else{
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

// Password management routes
router.get('/password/info', controller.getPasswordInfo);
router.put('/password/change', controller.changePassword);

router.get('/me', controller.getMyAccount); // Changed from chained route to direct GET
router.get('/guest-identity', controller.getGuestIdentity); // Added new route

router.route('/me') // The chained route for /me now only handles PATCH and DELETE
    .patch(upload.single('avatar'), controller.updateMyAccount)
    .delete(controller.deleteMyAccount);

export default router;
