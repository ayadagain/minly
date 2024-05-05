import { z } from 'zod';
import { Request, Response } from 'express';
import {eq} from 'drizzle-orm'
import * as bcrypt from 'bcryptjs';
import { fromError } from 'zod-validation-error';
import { createId } from '@paralleldrive/cuid2';
import jwt, {Secret} from 'jsonwebtoken'

import { db } from '../../db'
import { user, userTokens } from '../../db/schema';
import { sendEmail } from '../../utils';
import { ErrorMessage } from '../../types';

const JWT_SECRET:Secret = process.env.JWT_SECRET || ''


export class AuthController {
    static async register(req: Request, res: Response): Promise<Response> {        

        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;

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

            const verificationData = await db
                .insert(userTokens)
                .values({
                    token: emailVerificationToken,
                    userId: userData.uid,
                    op: 'ec',
                })
                .returning()

            if (!verificationData) {
                return res.status(400).json({
                    message: 'User registration failed',
                });
            }
            
            const emailVerificationTokenData = verificationData?.[0]?.token

            sendEmail(email, 'Email Verification', `Click on the link to verify your email: ${baseUrl}/api/v1/auth/verify-email/${emailVerificationTokenData}`)

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
    static async login(req: Request, res: Response) {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(6),
        })

        try {
            const { email, password} = schema.parse(req.body);

            const userData = await db
                .select()
                .from(user)
                .where(eq(user.email, email))

            if (!userData || userData.length === 0) {
                return res.status(400).json({
                    email: 'There is an issue with your email or password',
                });
            }

            const userValue = userData[0]

            if (!userValue.verified || !userValue.active) {
                return res.status(400).json({
                    message: 'Your email is not verified. Please verify your email to login',
                });
            }

            const passwordMatch = bcrypt.compareSync(password, userValue.password);

            if (!passwordMatch) {
                return res.status(400).json({
                    message: 'There is an issue with your email or password',
                })
            }

            const jwtToken = jwt.sign({
                _id: userValue.uid,
                name: userValue.name,
            }, JWT_SECRET, {
                expiresIn: '24h',
            })

            return res.status(200).json({
                message: 'You are now logged in',
                access_token: jwtToken, 
            });

        } catch (error) {
            const validationError = fromError(error);
            const errorMessages: ErrorMessage = {}

            validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
            return res.status(400).json(errorMessages);
        }
    }
    static async emailVerification(req: Request, res: Response) {
        const schema = z.object({
            token: z
                .string()
                .cuid2(),
        });

        try {
            const { token } = schema.parse(req.params);

            const tokenData = await db
                .select()
                .from(userTokens)
                .where(eq(userTokens.token, token))

            if (!tokenData || tokenData.length === 0) {
                return res.status(400).json({
                    message: 'Invalid token',
                });
            }

            const tokenDataValue = tokenData[0]

            // Check if the token has expired
            if (tokenDataValue.expiresAt < new Date()) {
                return res.status(400).json({
                    message: 'Token has expired',
                });
            }

            const updateUserData = await db
                .update(user)
                .set({
                    verified: true,
                    active: true,
                })
                .where(eq(user.uid, tokenDataValue.userId))
                .returning()

            if (!updateUserData) {
                return res.status(400).json({
                    message: 'User verification failed',
                });
            }

            await db
                .update(userTokens)
                .set({
                    active: false,
                })
                .where(eq(userTokens.token, token))
                .returning()
            
            return res.status(200).json({
                message: 'Your email is now verified. Please login to continue',
            });

        } catch (error) {
            const validationError = fromError(error);
            const errorMessages: ErrorMessage = {}

            validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
            return res.status(400).json(errorMessages);
        }

    }
    static async forgotPassword(req: Request, res: Response) {
        const host = req.get('host');
        const protocol = req.protocol;
        const baseUrl = `${protocol}://${host}`;
        
        const schema = z.object({
            email: z.string().email(),
        })
        try {
            const { email } = schema.parse(req.body);

            const userData = await db
                .select()
                .from(user)
                .where(eq(user.email, email))

            if (!userData || userData.length === 0) {
                return res.status(400).json({
                    message: "If the email exists, a password reset link will be sent to your email",
                })
            }

            const userValue = userData?.[0]

            const passwordResetToken = createId();

            const passwordResetTokenQuery= await db
                .insert(userTokens)
                .values({
                    token: passwordResetToken,
                    userId: userValue.uid,
                    op: 'rp',
                })
                .returning()

            if (!passwordResetTokenQuery) {
                return res.status(400).json({
                    message: "Something went wrong. Please try again",
                });
            }
            
            const passwordResetTokenData = passwordResetTokenQuery?.[0]?.token

            sendEmail(email, 'Password Reset', `Click on the link to reset your password: ${baseUrl}/api/v1/auth/reset-password/${passwordResetTokenData}`)

            return res.status(200).json({
                message: 'If the email exists, a password reset link will be sent to your email',
            });
        } catch (error) {
            const validationError = fromError(error);
            const errorMessages: ErrorMessage = {}

            validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
            return res.status(400).json(errorMessages);
        }
    }

    static async resetPassword(req: Request, res: Response) {
        const schema = z.object({
            token: z
                .string()
                .cuid2(),
            password: z.string().min(6),
            confirmPassword: z
                .string()
                .min(6)
                .refine((data) => data === req.body.password, {
                    message: 'Passwords do not match',
                })
        });

        try {
            req.body.token = req.params.token
            const { token, password } = schema.parse(req.body);

            const tokenData = await db
                .select()
                .from(userTokens)
                .where(eq(userTokens.token, token))

            if (!tokenData || tokenData.length === 0) {
                return res.status(400).json({
                    message: 'Invalid token',
                });
            }

            const tokenDataValue = tokenData[0]

            // Check if the token has expired or is inactive or is not a password reset token
            if (tokenDataValue.expiresAt < new Date() || tokenDataValue.active === false || tokenDataValue.op !== 'rp') {
                return res.status(400).json({
                    message: 'Invalid token',
                });
            }

            const hashedPassword = bcrypt.hashSync(password, 10);

            const updateUserData = await db
                .update(user)
                .set({
                    password: hashedPassword,
                })
                .where(eq(user.uid, tokenDataValue.userId))
                .returning()

            if (!updateUserData) {
                return res.status(400).json({
                    message: 'Password reset failed',
                });
            }

            await db
                .update(userTokens)
                .set({
                    active: false,
                })
                .where(eq(userTokens.token, token))
                .returning()
            
            return res.status(200).json({
                message: 'Your password has been reset successfully. Please login to continue',
            });

        } catch (error) {
            const validationError = fromError(error);
            const errorMessages: ErrorMessage = {}

            validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
            return res.status(400).json(errorMessages);
        }
    }

}