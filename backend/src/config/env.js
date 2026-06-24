require('dotenv').config();

const requiredVars = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of requiredVars) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

module.exports = {
  port:    process.env.PORT     || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: { url: process.env.DATABASE_URL },
  jwt: {
    accessSecret:  process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry:  process.env.JWT_ACCESS_EXPIRY  || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  aws: {
    region:          process.env.AWS_REGION          || 'ap-south-1',
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket:        process.env.AWS_S3_BUCKET,
  },
  mediaMtx: {
    server: process.env.MEDIAMTX_SERVER || 'http://localhost:8888',
  },
  cors:      { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS)    || 900000,
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
};
