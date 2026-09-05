// ============================================================
// WEBHOOKS CONTROLLER
// ============================================================

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/errors');

// MediaMTX sends: { "path": "live/RDNL0381" }
const handleMediaMtxReady = asyncHandler(async (req, res) => {
  const { path, shardUrl } = req.body;
  if (!path) {
    return res.status(400).json({ success: false, message: 'Path not provided' });
  }

  // Extract stream ID from path (e.g. "live/RDNL0381" -> "RDNL0381")
  const streamId = path.split('/').pop();

  // Find camera whose streamUrl ends with this stream ID
  const cameras = await prisma.camera.findMany({
    where: {
      streamUrl: {
        endsWith: streamId
      }
    }
  });

  if (cameras.length > 0) {
    await prisma.camera.updateMany({
      where: { id: { in: cameras.map(c => c.id) } },
      data: { status: 'ACTIVE', mediaMtxUrl: shardUrl || null }
    });
    console.log(`[Webhook] Stream ready for path ${path} on shard ${shardUrl || 'unknown'} - set ${cameras.length} camera(s) to ACTIVE`);
  } else {
    console.warn(`[Webhook] Stream ready for path ${path}, but no matching camera found.`);
  }

  res.json({ success: true });
});

const handleMediaMtxNotReady = asyncHandler(async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ success: false, message: 'Path not provided' });
  }

  const streamId = path.split('/').pop();

  const cameras = await prisma.camera.findMany({
    where: {
      streamUrl: {
        endsWith: streamId
      }
    }
  });

  if (cameras.length > 0) {
    await prisma.camera.updateMany({
      where: { id: { in: cameras.map(c => c.id) } },
      data: { status: 'INACTIVE' }
    });
    console.log(`[Webhook] Stream stopped for path ${path} - set ${cameras.length} camera(s) to INACTIVE`);
  } else {
    console.warn(`[Webhook] Stream stopped for path ${path}, but no matching camera found.`);
  }

  res.json({ success: true });
});

module.exports = {
  handleMediaMtxReady,
  handleMediaMtxNotReady
};
