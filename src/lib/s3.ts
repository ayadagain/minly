import * as AWS from "aws-sdk"

const s3 = new AWS.S3({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    signatureVersion: 'v4',
})

export default s3;

