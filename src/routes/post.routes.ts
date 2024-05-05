import { Router, Request, Response } from 'express';
const router: Router = Router();
import { PostController } from '../controllers/post/post.controller';
import jwtMiddleware from '../middlewares/jwt'

router.get('/', jwtMiddleware, PostController.getAllPosts);
router.post('/create', jwtMiddleware, PostController.createPost);

export default router;