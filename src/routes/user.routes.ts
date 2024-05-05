import { Router, Request, Response } from 'express';
const router: Router = Router();
import { AuthController } from '../controllers/auth/auth.controller';

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/verify-email/:token', AuthController.emailVerification);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password/:token', AuthController.resetPassword);

export default router;