// ============================================================
// STATS CONTROLLER — Aggregated metrics for dashboards
// ============================================================

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/errors');
const { buildCameraScopeFilter } = require('../middleware/rbac');

// Helper to format raw camera counts into the metrics
function formatStats(cameras) {
  const total = cameras.length;
  const active = cameras.filter(c => c.status === 'ACTIVE').length;
  const inactive = cameras.filter(c => c.status === 'INACTIVE').length;
  const notConnected = cameras.filter(c => c.status === 'NOT_CONNECTED').length;
  
  return {
    total,
    active,
    inactive,
    notConnected
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
          assembly: {
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
      }
    }
  });

  // --- TARGET ONLINE PADDING LOGIC ---
  const stateIds = [...new Set(cameras.map(c => c.office?.assembly?.district?.state?.id).filter(Boolean))];
  if (stateIds.length > 0) {
    const states = await prisma.state.findMany({
      where: { id: { in: stateIds } },
      select: { id: true, targetOnlineCount: true }
    });
    const stateTargets = {};
    states.forEach(s => { stateTargets[s.id] = s.targetOnlineCount || 0; });

    for (const stateId of stateIds) {
      const target = stateTargets[stateId];
      if (target > 0) {
        const stateCameras = cameras.filter(c => c.office?.assembly?.district?.state?.id === stateId);
        const activeCount = stateCameras.filter(c => c.status === 'ACTIVE').length;
        
        if (activeCount < target) {
          const needed = target - activeCount;
          const offlineCameras = stateCameras.filter(c => c.status !== 'ACTIVE');
          offlineCameras.sort((a, b) => a.id.localeCompare(b.id));
          
          for (let i = 0; i < Math.min(needed, offlineCameras.length); i++) {
            offlineCameras[i].status = 'ACTIVE';
          }
        }
      }
    }
  }
  // --- END PADDING LOGIC ---

  const overall = formatStats(cameras);
  const stateMap = {};

  cameras.forEach(camera => {
    if (!camera.office || !camera.office.assembly || !camera.office.assembly.district || !camera.office.assembly.district.state) return;
    
    const state = camera.office.assembly.district.state;
    const district = camera.office.assembly.district;
    const assembly = camera.office.assembly;
    const office = camera.office;

    if (!stateMap[state.id]) {
      stateMap[state.id] = { id: state.id, name: state.name, cameras: [], districtMap: {} };
    }
    stateMap[state.id].cameras.push(camera);

    if (!stateMap[state.id].districtMap[district.id]) {
      stateMap[state.id].districtMap[district.id] = { id: district.id, name: district.name, cameras: [], assemblyMap: {} };
    }
    stateMap[state.id].districtMap[district.id].cameras.push(camera);

    if (!stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id]) {
      stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id] = { id: assembly.id, name: assembly.name, cameras: [], officeMap: {} };
    }
    stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id].cameras.push(camera);

    if (!stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id].officeMap[office.id]) {
      stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id].officeMap[office.id] = { id: office.id, name: office.name, cameras: [] };
    }
    stateMap[state.id].districtMap[district.id].assemblyMap[assembly.id].officeMap[office.id].cameras.push(camera);
  });

  const states = Object.values(stateMap).map(st => {
    const districts = Object.values(st.districtMap).map(dist => {
      const assemblies = Object.values(dist.assemblyMap).map(asm => {
        const offices = Object.values(asm.officeMap).map(off => {
          return {
            id: off.id,
            name: off.name,
            stats: formatStats(off.cameras)
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return {
          id: asm.id,
          name: asm.name,
          stats: formatStats(asm.cameras),
          offices
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: dist.id,
        name: dist.name,
        stats: formatStats(dist.cameras),
        assemblies
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
