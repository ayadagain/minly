import busboy from 'busboy';
import { z } from 'zod';
import { Request, Response } from 'express';
import {desc} from 'drizzle-orm'
import {uploadFile, getPresignedUrl} from '../../utils'
import { db } from '../../db'
import { post } from '../../db/schema';
import { FileName } from "../../types"
import { CustomRequest } from '../../interfaces';

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
        const posts = await db
            .select({
                pid: post.uid,
                image: post.image,
                caption: post.caption,
                createdAt: post.createdAt,
            })
            .from(post)
            .orderBy(desc(post.createdAt))

        const postsWithPresignedUrls = await Promise.all(posts.map(async post => {
            post.image = await getPresignedUrl(post.image);
            return post;
        }))

        return res.status(200).send(postsWithPresignedUrls);
    }
    static async getPost(req: Request, res: Response) {}
    static async updatePost(req: Request, res: Response) {}
    static async deletePost(req: Request, res: Response) {}
    static async likePost(req: Request, res: Response) {}
    static async unlikePost(req: Request, res: Response) {}
}