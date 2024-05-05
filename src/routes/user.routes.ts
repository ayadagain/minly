import { Router, Request, Response } from 'express';
const router: Router = Router();
import { AuthController } from '../controllers/auth/auth.controller';

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

export default router;