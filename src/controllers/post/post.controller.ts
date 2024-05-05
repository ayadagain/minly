import busboy from 'busboy';
import { z } from 'zod';
import { Request, Response } from 'express';
import {desc, eq, and} from 'drizzle-orm'
import { fromError } from 'zod-validation-error';

import {uploadFile, getPresignedUrl} from '../../utils'
import { db } from '../../db'
import { post, user, likes } from '../../db/schema';
import { FileName } from "../../types"
import { CustomRequest } from '../../interfaces';
import { ErrorMessage } from '../../types';
import { alias } from 'drizzle-orm/pg-core';
import { pid } from 'process';


export class PostController {
    static async createPost(req: CustomRequest, res: Response) {
        const bb = busboy({ headers: req.headers });
        const filesProcessed: Promise<AWS.S3.ManagedUpload.SendData>[] = [];
        let userCaption = "";

        bb.on('file', (_: string, file: any, filename: FileName) => {
            if (!filename.mimeType.startsWith('image')) {
                res.status(400).send({message: "Only image files are allowed"});
                return;
            }

            const chunks: Buffer[] = [];
            
            const filePromise = new Promise<AWS.S3.ManagedUpload.SendData>((resolve, reject) => {
                file.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                }).on('end', async () => {
                    try {
                        const data = uploadFile(filename, Buffer.concat(chunks));
                        resolve(data);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
    
            filesProcessed.push(filePromise);
        });
    
        bb.on('field', (fieldname: string, val: string) => {
            if (fieldname === 'caption') {
                userCaption = val;
            }
        })

        bb.on('finish', () => {
            Promise.allSettled(filesProcessed).then(async results => {
                const firstRejected = results.find(result => result.status === 'rejected');
    
                if (firstRejected) {
                    res.status(500).send({message: "Internal Server Error"});
                } else if (results[0] && results[0].status === 'fulfilled') {
                    const pictureKey = results[0].value.Key;

                    const newPost = await db.insert(post).values({
                        image: pictureKey,
                        author: req.user?.uid!,
                        caption: userCaption
                    }).returning()

                    res.status(200).send(
                        {
                            message: "Post created successfully",
                            post: newPost[0]
                        }
                    );
                } else {
                    res.status(400).send({message: "No files were uploaded"});
                }
            }).catch(err => {
                console.error("Error handling the finish event:", err);
                if (!res.headersSent) {
                    res.status(500).send({message: "Server error processing files"});
                }
            });
        });
    
        req.pipe(bb);
    }    
    static async getAllPosts(req: Request, res: Response) {
        const likers = alias(user, 'likers');
        const posts = await db
            .select({
                uid: post.uid,
                image: post.image,
                caption: post.caption,
                createdAt: post.createdAt,
                author: user.name,
                likes: likes,
                likers: likers
            })
            .from(post)
            .leftJoin(user, eq(post.author, user.uid))
            .leftJoin(likes, eq(post.uid, likes.postId))
            .leftJoin(likers, eq(likes.userId, likers.uid))
            .orderBy(desc(post.createdAt))

        const postMap = new Map();

        posts.forEach(post => {
            if (!postMap.has(post.uid)) {
                postMap.set(post.uid, {
                    pid: post.uid,
                    image: post.image,
                    caption: post.caption,
                    createdAt: post.createdAt, 
                    author: post.author,
                    likes: []
                })
            }

            const postObj = postMap.get(post.uid);

            if (post.likes) {
                postObj.likes.push({
                    id: post.likes.uid,
                    userId: post.likes.userId,
                    name: post.likers?.name
                });
            }
        })

        const postsArray = Array.from(postMap.values());

        const postsWithPresignedUrls = await Promise.all(postsArray.map(async post => {
            post.image = await getPresignedUrl(post.image);
            return post;
        }))

        return res.status(200).send(postsWithPresignedUrls);
    }
    static async getPost(req: Request, res: Response) {
        const postId = req.params.id;
        const likers = alias(user, 'likers');

        try {
            const postQ = await db
                .select({
                    uid: post.uid,
                    image: post.image,
                    caption: post.caption,
                    author: user.name,
                    createdAt: post.createdAt,
                    likes: likes,
                    likers: likers
                })
                .from(post)
                .leftJoin(user, eq(post.author, user.uid))
                .leftJoin(likes, eq(post.uid, likes.postId))
                .leftJoin(likers, eq(likes.userId, likers.uid))
                .where(eq(post.uid, postId))
            
            if (postQ.length === 0) {
                return res.status(404).send({message: "Post not found"});
            }
            
            const postMap = new Map();

            postQ.forEach(post => {
                if (!postMap.has(post.uid)) {
                    postMap.set(post.uid, {
                        pid: post.uid,
                        image: post.image,
                        caption: post.caption,
                        createdAt: post.createdAt, 
                        author: post.author,
                        likes: []
                    })
                }
    
                const postObj = postMap.get(post.uid);
    
                if (post.likes) {
                    postObj.likes.push({
                        id: post.likes.uid,
                        userId: post.likes.userId,
                        name: post.likers?.name
                    });
                }
            })

            const postsArray = Array.from(postMap.values());

            const postsWithPresignedUrls = await Promise.all(postsArray.map(async post => {
                post.image = await getPresignedUrl(post.image);
                return post;
            }))

            return res.status(200).send(postsWithPresignedUrls[0]);
        } catch (error) {
            console.error("Error fetching post:", error);
            return res.status(500).send({message: "Internal Server Error"});
        }
    }
    static async updatePost(req: CustomRequest, res: Response) {
        const schema = z.object({
            caption: z.string().min(2, {message: "Caption must be at least 2 characters long"})
        });

        try {
            const { caption } = schema.parse(req.body);
            const postId = req.params.id;

            const postQ = await db
                .select()
                .from(post)
                .where(eq(post.uid, postId))

            if (postQ.length === 0) {
                return res.status(404).send({message: "Post not found"});
            }

            const postData = postQ[0]

            if (postData.author !== req.user?.uid) {
                return res.status(403).send({message: "Unauthorized"});
            }

            const updatedPost = await db
                .update(post)
                .set({caption})
                .where(eq(post.uid, postId))
                .returning()

            return res.status(200).send({
                message: "Post updated successfully",
                post: updatedPost[0]
            })
    
        } catch (error) {
            if (error instanceof z.ZodError) {
                const validationError = fromError(error);
                const errorMessages: ErrorMessage = {}
    
                validationError.details.forEach((error) => errorMessages[error.path[0]] = error.message)
                return res.status(400).json(errorMessages);
            } else {
                console.error("Error updating post:", error);
                return res.status(500).send({message: "Internal Server Error"});
            }
        }
    }
    static async deletePost(req: CustomRequest, res: Response) {
        try {
            const postId = req.params.id;

            const postQ = await db 
                .select()
                .from(post)
                .where(eq(post.uid, postId))

            if (postQ.length === 0) {
                return res.status(404).send({message: "Post not found"});
            }

            const postData = postQ[0]

            if (postData.author !== req.user?.uid) {
                return res.status(403).send({message: "Unauthorized"});
            }

            await db
                .delete(post)
                .where(eq(post.uid, postId))

            return res.status(200).send({message: "Post deleted successfully"});

        } catch (error) {
            console.error("Error deleting post:", error);
            return res.status(500).send({message: "Internal Server Error"});
        }
    }
    static async likePost(req: CustomRequest, res: Response) {
        try {
            const postId = req.params.id; 
            const userId = req.user?.uid;

            const postQ = await db
                .select()
                .from(post)
                .where(eq(post.uid, postId))
            
            if (postQ.length === 0) {
                return res.status(404).send({message: "Post not found"});
            }

            const likeQ = await db
                .select()
                .from(likes)
                .where(
                    and(
                        eq(likes.postId, postId),
                        eq(likes.userId, userId!)
                    )
                )
            
            if (likeQ.length > 0) {
                return res.status(400).send({message: "Post already liked"});
            }

            await db.insert(likes).values({
                postId,
                userId: userId!
            })

            return res.status(200).send({message: "Post liked successfully"});
        } catch (error) {
            console.error("Error liking post:", error);
            return res.status(500).send({message: "Internal Server Error"});
        }
    }
    static async unlikePost(req: CustomRequest, res: Response) {
        try {
            const postId = req.params.id; 
            const userId = req.user?.uid;

            const postQ = await db
                .select()
                .from(post)
                .where(eq(post.uid, postId))
            
            if (postQ.length === 0) {
                return res.status(404).send({message: "Post not found"});
            }

            const likeQ = await db
                .select()
                .from(likes)
                .where(
                    and(
                        eq(likes.postId, postId),
                        eq(likes.userId, userId!)
                    )
                )
            
            if (likeQ.length > 0) {
                await db
                    .delete(likes)
                    .where(
                        and(
                            eq(likes.postId, postId),
                            eq(likes.userId, userId!)
                        )
                    )

                return res.status(200).send({message: "Post unliked successfully"});
            } 

            return res.status(400).send({message: "Post not liked"});
        } catch (error) {
            console.error("Error unliking post:", error);
            return res.status(500).send({message: "Internal Server Error"});
        }
    }
}