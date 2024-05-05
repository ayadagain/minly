import { Router, Request, Response } from 'express';
const router: Router = Router();
import { PostController } from '../controllers/post/post.controller';
import jwtMiddleware from '../middlewares/jwt'

router.get('/', jwtMiddleware, PostController.getAllPosts);
router.post('/create', jwtMiddleware, PostController.createPost);
router.get('/:id', jwtMiddleware, PostController.getPost);
router.patch('/:id', jwtMiddleware, PostController.updatePost);
router.delete('/:id', jwtMiddleware, PostController.deletePost);
router.post('/:id/like', jwtMiddleware, PostController.likePost);
router.delete('/:id/like', jwtMiddleware, PostController.unlikePost);

export default router;