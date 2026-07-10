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
              state: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  const overall = formatStats(cameras);
  const stateMap = {};

  cameras.forEach(camera => {
    if (!camera.office || !camera.office.district || !camera.office.district.state) return;
    
    const state = camera.office.district.state;
    const district = camera.office.district;
    const office = camera.office;

    if (!stateMap[state.id]) {
      stateMap[state.id] = { id: state.id, name: state.name, cameras: [], districtMap: {} };
    }
    stateMap[state.id].cameras.push(camera);

    if (!stateMap[state.id].districtMap[district.id]) {
      stateMap[state.id].districtMap[district.id] = { id: district.id, name: district.name, cameras: [], officeMap: {} };
    }
    stateMap[state.id].districtMap[district.id].cameras.push(camera);

    if (!stateMap[state.id].districtMap[district.id].officeMap[office.id]) {
      stateMap[state.id].districtMap[district.id].officeMap[office.id] = { id: office.id, name: office.name, cameras: [] };
    }
    stateMap[state.id].districtMap[district.id].officeMap[office.id].cameras.push(camera);
  });

  const states = Object.values(stateMap).map(st => {
    const districts = Object.values(st.districtMap).map(dist => {
      const offices = Object.values(dist.officeMap).map(off => {
        return {
          id: off.id,
          name: off.name,
          stats: formatStats(off.cameras)
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: dist.id,
        name: dist.name,
        stats: formatStats(dist.cameras),
        offices
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: st.id,
      name: st.name,
      stats: formatStats(st.cameras),
      districts
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    data: {
      overall,
      states
    }
  });
});

module.exports = {
  getCameraStats
};
