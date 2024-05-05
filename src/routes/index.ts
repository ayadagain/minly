import e, { Router } from 'express';
const router: Router = Router();

import postRoutes from './post.routes';
import userRoutes from './user.routes';

router.use('/post', postRoutes);
router.use('/auth', userRoutes);

export default router;