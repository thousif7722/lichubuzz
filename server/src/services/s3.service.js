'use strict';
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

const BUCKET = process.env.AWS_S3_BUCKET || 'servicehub-dev';

const s3Service = {
  async upload(key, body, contentType = 'application/octet-stream') {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[DEV S3] Upload: ${key} (${contentType})`);
      return `https://dev-s3.servicehub.in/${key}`;
    }
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    }));
    return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  },

  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  async delete(key) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  },
};

module.exports = { s3Service };
