// ============================================================
// WEBHOOKS CONTROLLER
// ============================================================

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/errors');

// MediaMTX sends: { "path": "live/RDNL0381" }
const handleMediaMtxReady = asyncHandler(async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ success: false, message: 'Path not provided' });
  }

  // Find camera whose streamUrl ends with this path
  const cameras = await prisma.camera.findMany({
    where: {
      streamUrl: {
        contains: path
      }
    }
  });

  if (cameras.length > 0) {
    await prisma.camera.updateMany({
      where: { id: { in: cameras.map(c => c.id) } },
      data: { status: 'ACTIVE' }
    });
    console.log(`[Webhook] Stream ready for path ${path} - set ${cameras.length} camera(s) to ACTIVE`);
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

  const cameras = await prisma.camera.findMany({
    where: {
      streamUrl: {
        contains: path
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
