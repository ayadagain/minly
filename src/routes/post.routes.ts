import { Router, Request, Response } from 'express';
const router: Router = Router();

router.get('/', (req: Request, res: Response) => {
    return res.status(200).json({
        message: 'Fetch all posts!',
        uuid: crypto.randomUUID()
    })
})

router.post('/', (req: Request, res: Response) => {
    return res.status(200).json({
        message: 'Post a new pic!'
    })
})

router.patch('/:id', (req: Request, res: Response) => {
    return res.status(200).json({
        message: 'Edited a pic'
    })
})

router.delete('/:id', (req: Request, res: Response) => {
    return res.status(200).json({
        message: 'Deleted a pic!'
    })
})

export default router;