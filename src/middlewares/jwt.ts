import { Request, Response, NextFunction } from 'express';
import jwt, {Secret} from 'jsonwebtoken'
import { eq } from 'drizzle-orm';
import { db } from '../db'
import { user } from '../db/schema';
import { CustomRequest } from '../interfaces';

const jwtMiddleware = async (req: CustomRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization']
    const JWT_SECRET:Secret = process.env.JWT_SECRET || ''
    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) return res.sendStatus(401)

    jwt.verify(token, JWT_SECRET, async(err, tokenData) => {
        if (err) return res.sendStatus(403)

        type TokenData = {
            _id: string,
            name: string
        }

        const { _id, name } = tokenData as TokenData

        const userData = await db
            .select({
                uid: user.uid,
                name: user.name,
                email: user.email,
                active: user.active,
                verified: user.verified
            })
            .from(user)
            .where(eq(user.uid, _id))

        if (userData.length === 0) {
            return res.sendStatus(403)
        }

        req.user = userData[0]
        next()
    })
}

export default jwtMiddleware;