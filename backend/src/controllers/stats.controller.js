// ============================================================
// STATS CONTROLLER — Aggregated metrics for dashboards
// ============================================================

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/errors');
const { buildCameraScopeFilter } = require('../middleware/rbac');

// Helper to format raw camera counts into the 5 metrics
function formatStats(cameras) {
  const total = cameras.length;
  const online = cameras.filter(c => c.status === 'ACTIVE').length;
  const notConnected = cameras.filter(c => c.status === 'INACTIVE').length;
  const maintenance = cameras.filter(c => c.status === 'MAINTENANCE').length;
  
  return {
    total,
    online,
    notConnected,
    onceLive: online, // Mapped to online per current schema
    activeToday: online, // Mapped to online per current schema
    maintenance
  };
}

// ============================================================
// GET /api/stats/cameras — Get camera stats (overall + regional)
// ============================================================
const getCameraStats = asyncHandler(async (req, res) => {
  const { role } = req.user;
  const baseWhere = {
    ...buildCameraScopeFilter(req.scope),
    isActive: true, // Only count non-deleted cameras
  };

  // Fetch all accessible cameras with their location relations
  const cameras = await prisma.camera.findMany({
    where: baseWhere,
    select: {
      id: true,
      status: true,
      office: {
        select: {
          id: true,
          name: true,
          district: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }
    }
  });

  const overall = formatStats(cameras);
  const regionalMap = {};

  // Determine grouping level
  const groupByDistrict = ['SUPER_ADMIN', 'STATE_ADMIN'].includes(role);

  cameras.forEach(camera => {
    let regionId, regionName;

    if (groupByDistrict) {
      if (!camera.office?.district) return; // Should not happen, but safe guard
      regionId = camera.office.district.id;
      regionName = camera.office.district.name;
    } else {
      if (!camera.office) return;
      regionId = camera.office.id;
      regionName = camera.office.name;
    }

    if (!regionalMap[regionId]) {
      regionalMap[regionId] = {
        id: regionId,
        name: regionName,
        cameras: []
      };
    }
    regionalMap[regionId].cameras.push(camera);
  });

  const regions = Object.values(regionalMap).map(region => {
    return {
      id: region.id,
      name: region.name,
      stats: formatStats(region.cameras)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    data: {
      overall,
      regions
    }
  });
});

module.exports = {
  getCameraStats
};
