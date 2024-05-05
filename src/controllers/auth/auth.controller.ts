import { z } from 'zod';
import { Request, Response } from 'express';
import {eq} from 'drizzle-orm'
import * as bcrypt from 'bcryptjs';
import { fromError } from 'zod-validation-error';
import { createId } from '@paralleldrive/cuid2';

import { db } from '../../db'
import { user, emailVerification } from '../../db/schema';

export class AuthController {
    static async register(req: Request, res: Response): Promise<Response> {        
        type ErrorMessage = {
            [key: string]: string;
        }

        const schema = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(6),
            confirmPassword: z
                .string()
                .min(6)
                .refine((data) => data === req.body.password, {
                    message: 'Passwords do not match',
                })
        });

        try {
            const { name, email, password, confirmPassword } = schema.parse(req.body);

            const userExists = await db
                .select()
                .from(user)
                .where(eq(user.email, email))

            if (userExists?.length > 0) {
                return res.status(400).json({
                    email: 'Email already exists',
                });
            }

            const hashedPassword = bcrypt.hashSync(password, 10);
            
            const newUser = await db
                .insert(user)
                .values({
                    name,
                    email,
                    password: hashedPassword,
                })
                .returning()
            
            const userData = newUser?.[0]

            if (!newUser || !userData) {
                return res.status(400).json({
                    message: 'User registration failed',
                });
            }

            const emailVerificationToken = createId();




            return res.status(200).json({
                message: 'User registered successfully',
            });
        } catch (error) {
            const validationError = fromError(error);
            const errorMessages: ErrorMessage = {}

            validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
            return res.status(400).json(errorMessages);
        }
    }
    static async login(req: Request, res: Response) {}
    static async emailVerification(req: Request, res: Response) {}
    static async forgotPassword(req: Request, res: Response) {}

}