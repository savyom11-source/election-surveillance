-- Migration: add_stream_type
-- Adds StreamType enum, renames rtspUrl -> streamUrl,
-- removes hlsUrl (now generated dynamically),
-- adds streamType column to cameras

-- Step 1: Create StreamType enum
CREATE TYPE "StreamType" AS ENUM ('RTMP', 'RTSP');

-- Step 2: Add streamUrl column (copy data from rtspUrl if exists)
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "streamUrl" TEXT;

-- Step 3: Copy existing rtspUrl data to streamUrl
UPDATE "cameras" SET "streamUrl" = "rtspUrl" WHERE "rtspUrl" IS NOT NULL;

-- Step 4: Set default for any nulls
UPDATE "cameras" SET "streamUrl" = '' WHERE "streamUrl" IS NULL;

-- Step 5: Make streamUrl NOT NULL
ALTER TABLE "cameras" ALTER COLUMN "streamUrl" SET NOT NULL;

-- Step 6: Add streamType column with default RTMP
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "streamType" "StreamType" NOT NULL DEFAULT 'RTMP';

-- Step 7: Drop old columns
ALTER TABLE "cameras" DROP COLUMN IF EXISTS "rtspUrl";
ALTER TABLE "cameras" DROP COLUMN IF EXISTS "hlsUrl";
