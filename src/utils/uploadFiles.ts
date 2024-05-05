import { createId } from '@paralleldrive/cuid2';
import * as AWS from "aws-sdk"
import { FileName } from "../types"
import { s3 } from '../lib'

const uploadFile = async (filename: FileName, file : Buffer) => {
    let params = {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: `${createId()}_${filename.filename}`,
        Body: file,
        ContentType: filename.mimeType,
    }
    return await s3.upload(params).promise()
}

export default uploadFile