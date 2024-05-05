import * as AWS from "aws-sdk"
import { s3 } from "../lib"

const getPresignedUrl = async (filename: string) => {
    let params = {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: filename,
        Expires: 3600,
    }
    return await s3.getSignedUrl('getObject', params)
}

export default getPresignedUrl