// ============================================================
// LOCATION CONTROLLER — States / Districts / Assemblies / Offices CRUD
//
// CASCADE SOFT-DELETE:
//   Deactivate State    → deactivates Districts + Assemblies + Offices + Cameras
//   Deactivate District → deactivates Assemblies + Offices + Cameras
//   Deactivate Assembly → deactivates Offices + Cameras
//   Deactivate Office   → deactivates Cameras
//
// CASCADE REACTIVATE:
//   Reactivate State    → reactivates Districts + Assemblies + Offices + Cameras
//   Reactivate District → reactivates Assemblies + Offices + Cameras
//   Reactivate Assembly → reactivates Offices + Cameras
//   Reactivate Office   → reactivates Cameras
// ============================================================

const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, ValidationError, asyncHandler } = require('../utils/errors');
const { logAudit } = require('../services/audit.service');
const {
  buildStateScopeFilter,
  buildDistrictScopeFilter,
  buildAssemblyScopeFilter,
  buildOfficeScopeFilter,
} = require('../middleware/rbac');
const { ForbiddenError } = require('../utils/errors');

function activeFilter(req) {
  return req.query.includeInactive === 'true' ? {} : { isActive: true };
}

// ============================================================
// STATES
// ============================================================

const getStates = asyncHandler(async (req, res) => {
  const where = { ...buildStateScopeFilter(req.scope), ...activeFilter(req) };
  const states = await prisma.state.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { districts: true } } },
  });
  res.json({ success: true, data: states });
});

const getStateById = asyncHandler(async (req, res) => {
  const state = await prisma.state.findFirst({
    where: { id: req.params.id, ...buildStateScopeFilter(req.scope) },
    include: { _count: { select: { districts: true } } },
  });
  if (!state) throw new NotFoundError('State not found');
  res.json({ success: true, data: state });
});

const createState = asyncHandler(async (req, res) => {
  const { name, code } = req.body;

  const existing = await prisma.state.findFirst({ where: { OR: [{ name }, { code }] } });
  if (existing) throw new ConflictError('A state with this name or code already exists');

  const state = await prisma.state.create({ data: { name, code } });

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_LOCATION',
    metadata: { type: 'state', id: state.id, name: state.name },
    req,
  });

  res.status(201).json({ success: true, data: state });
});

const updateState = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, isActive, targetOnlineCount } = req.body;

  const existing = await prisma.state.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('State not found');

  if (name || code) {
    const conflict = await prisma.state.findFirst({
      where: { id: { not: id }, OR: [...(name ? [{ name }] : []), ...(code ? [{ code }] : [])] },
    });
    if (conflict) throw new ConflictError('A state with this name or code already exists');
  }

  // ---- CASCADE REACTIVATE ----
  if (isActive === true && existing.isActive === false) {
    const districts = await prisma.district.findMany({ where: { stateId: id }, select: { id: true } });
    const districtIds = districts.map(d => d.id);

    const assemblies = districtIds.length ? await prisma.assembly.findMany({ where: { districtId: { in: districtIds } }, select: { id: true } }) : [];
    const assemblyIds = assemblies.map(a => a.id);

    const offices = assemblyIds.length ? await prisma.office.findMany({ where: { assemblyId: { in: assemblyIds } }, select: { id: true } }) : [];
    const officeIds = offices.map(o => o.id);

    await prisma.$transaction([
      // Reactivate the state
      prisma.state.update({ where: { id }, data: { isActive: true } }),
      ...(districtIds.length ? [prisma.district.updateMany({ where: { id: { in: districtIds } }, data: { isActive: true } })] : []),
      ...(assemblyIds.length ? [prisma.assembly.updateMany({ where: { id: { in: assemblyIds } }, data: { isActive: true } })] : []),
      ...(officeIds.length ? [prisma.office.updateMany({ where: { id: { in: officeIds } }, data: { isActive: true } })] : []),
      ...(officeIds.length ? [prisma.camera.updateMany({ where: { officeId: { in: officeIds } }, data: { isActive: true } })] : []),
    ]);

    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE_LOCATION',
      metadata: {
        type: 'state', id, action: 'reactivated',
        cascadeReactivated: { districts: districtIds.length, assemblies: assemblyIds.length, offices: officeIds.length },
      },
      req,
    });

    const updated = await prisma.state.findUnique({ where: { id } });
    return res.json({
      success: true,
      data: updated,
      message: `State reactivated along with ${districtIds.length} district(s), ${assemblyIds.length} assembly(s), ${officeIds.length} office(s) and their cameras`,
    });
  }

  // Normal update
  const state = await prisma.state.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(isActive !== undefined && { isActive }),
      ...(targetOnlineCount !== undefined && { targetOnlineCount: targetOnlineCount === '' ? null : parseInt(targetOnlineCount) }),
    },
  });

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_LOCATION',
    metadata: { type: 'state', id, changes: req.body },
    req,
  });

  res.json({ success: true, data: state });
});

const deleteState = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.state.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('State not found');

  // ---- HARD DELETE (CASCADE) ----
  const districts = await prisma.district.findMany({ where: { stateId: id }, select: { id: true } });
  const districtIds = districts.map(d => d.id);

  const assemblies = districtIds.length ? await prisma.assembly.findMany({ where: { districtId: { in: districtIds } }, select: { id: true } }) : [];
  const assemblyIds = assemblies.map(a => a.id);

  const offices = assemblyIds.length ? await prisma.office.findMany({ where: { assemblyId: { in: assemblyIds } }, select: { id: true } }) : [];
  const officeIds = offices.map(o => o.id);

  const cameras = officeIds.length
    ? await prisma.camera.findMany({ where: { officeId: { in: officeIds } }, select: { id: true } })
    : [];
  const cameraIds = cameras.map((c) => c.id);

  await prisma.$transaction([
    prisma.userScope.deleteMany({ where: { stateId: id } }),
    ...(districtIds.length ? [prisma.userScope.deleteMany({ where: { districtId: { in: districtIds } } })] : []),
    ...(assemblyIds.length ? [prisma.userScope.deleteMany({ where: { assemblyId: { in: assemblyIds } } })] : []),
    ...(officeIds.length ? [prisma.userScope.deleteMany({ where: { officeId: { in: officeIds } } })] : []),
    ...(cameraIds.length ? [prisma.auditLog.deleteMany({ where: { cameraId: { in: cameraIds } } })] : []),
    prisma.state.delete({ where: { id } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: {
      type: 'state', id, name: existing.name,
      cascadeDeleted: { districts: districtIds.length, assemblies: assemblyIds.length, offices: officeIds.length, cameras: cameraIds.length },
    },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `State "${existing.name}" permanently deleted along with all its data`,
    },
  });
});

// ============================================================
// DISTRICTS
// ============================================================

const getDistricts = asyncHandler(async (req, res) => {
  const { stateId } = req.query;
  const where = {
    ...buildDistrictScopeFilter(req.scope),
    ...(stateId && { stateId }),
    ...activeFilter(req),
  };
  const districts = await prisma.district.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      state: { select: { id: true, name: true, code: true } },
      _count: { select: { assemblies: true } },
    },
  });
  res.json({ success: true, data: districts });
});

const getDistrictById = asyncHandler(async (req, res) => {
  const district = await prisma.district.findFirst({
    where: { id: req.params.id, ...buildDistrictScopeFilter(req.scope) },
    include: {
      state: { select: { id: true, name: true, code: true } },
      _count: { select: { assemblies: true } },
    },
  });
  if (!district) throw new NotFoundError('District not found');
  res.json({ success: true, data: district });
});

const createDistrict = asyncHandler(async (req, res) => {
  const { name, code, stateId } = req.body;

  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) throw new ValidationError('stateId does not reference an existing state');

  if (!req.scope.isSuperAdmin && !req.scope.stateIds.includes(stateId)) {
    throw new ForbiddenError('You can only create districts within your assigned state');
  }

  const existing = await prisma.district.findFirst({ where: { stateId, code } });
  if (existing) throw new ConflictError(`A district with code "${code}" already exists in this state`);

  const district = await prisma.district.create({ data: { name, code, stateId } });

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_LOCATION',
    metadata: { type: 'district', id: district.id, name: district.name },
    req,
  });

  res.status(201).json({ success: true, data: district });
});

const updateDistrict = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, stateId, isActive } = req.body;

  const existing = await prisma.district.findFirst({ where: { id, ...buildDistrictScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('District not found or access denied');

  if (stateId) {
    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) throw new ValidationError('stateId does not reference an existing state');
    if (!req.scope.isSuperAdmin && !req.scope.stateIds.includes(stateId)) {
      throw new ForbiddenError('You can only assign districts to your assigned state');
    }
  }

  // ---- CASCADE REACTIVATE ----
  if (isActive === true && existing.isActive === false) {
    const assemblies = await prisma.assembly.findMany({ where: { districtId: id }, select: { id: true } });
    const assemblyIds = assemblies.map(a => a.id);

    const offices = assemblyIds.length ? await prisma.office.findMany({ where: { assemblyId: { in: assemblyIds } }, select: { id: true } }) : [];
    const officeIds = offices.map(o => o.id);

    await prisma.$transaction([
      prisma.district.update({ where: { id }, data: { isActive: true } }),
      ...(assemblyIds.length ? [prisma.assembly.updateMany({ where: { id: { in: assemblyIds } }, data: { isActive: true } })] : []),
      ...(officeIds.length ? [prisma.office.updateMany({ where: { id: { in: officeIds } }, data: { isActive: true } })] : []),
      ...(officeIds.length ? [prisma.camera.updateMany({ where: { officeId: { in: officeIds } }, data: { isActive: true } })] : []),
    ]);

    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE_LOCATION',
      metadata: {
        type: 'district', id, action: 'reactivated',
        cascadeReactivated: { assemblies: assemblyIds.length, offices: officeIds.length },
      },
      req,
    });

    const updated = await prisma.district.findUnique({ where: { id } });
    return res.json({
      success: true,
      data: updated,
      message: `District reactivated along with ${assemblyIds.length} assembly(s), ${officeIds.length} office(s) and their cameras`,
    });
  }

  const district = await prisma.district.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(stateId !== undefined && { stateId }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_LOCATION',
    metadata: { type: 'district', id, changes: req.body },
    req,
  });

  res.json({ success: true, data: district });
});

const deleteDistrict = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.district.findFirst({ where: { id, ...buildDistrictScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('District not found or access denied');

  const assemblies = await prisma.assembly.findMany({ where: { districtId: id }, select: { id: true } });
  const assemblyIds = assemblies.map(a => a.id);

  const offices = assemblyIds.length ? await prisma.office.findMany({ where: { assemblyId: { in: assemblyIds } }, select: { id: true } }) : [];
  const officeIds = offices.map(o => o.id);

  const cameras = officeIds.length
    ? await prisma.camera.findMany({ where: { officeId: { in: officeIds } }, select: { id: true } })
    : [];
  const cameraIds = cameras.map((c) => c.id);

  await prisma.$transaction([
    prisma.userScope.deleteMany({ where: { districtId: id } }),
    ...(assemblyIds.length ? [prisma.userScope.deleteMany({ where: { assemblyId: { in: assemblyIds } } })] : []),
    ...(officeIds.length ? [prisma.userScope.deleteMany({ where: { officeId: { in: officeIds } } })] : []),
    ...(cameraIds.length ? [prisma.auditLog.deleteMany({ where: { cameraId: { in: cameraIds } } })] : []),
    prisma.district.delete({ where: { id } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: {
      type: 'district', id, name: existing.name,
      cascadeDeleted: { assemblies: assemblyIds.length, offices: officeIds.length, cameras: cameraIds.length },
    },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `District "${existing.name}" permanently deleted along with all its data`,
    },
  });
});

// ============================================================
// ASSEMBLIES
// ============================================================

const getAssemblies = asyncHandler(async (req, res) => {
  const { districtId } = req.query;
  const where = {
    ...buildAssemblyScopeFilter(req.scope),
    ...(districtId && { districtId }),
    ...activeFilter(req),
  };
  const assemblies = await prisma.assembly.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      district: { select: { id: true, name: true, code: true, state: { select: { id: true, name: true, code: true } } } },
      _count: { select: { offices: true } },
    },
  });
  res.json({ success: true, data: assemblies });
});

const getAssemblyById = asyncHandler(async (req, res) => {
  const assembly = await prisma.assembly.findFirst({
    where: { id: req.params.id, ...buildAssemblyScopeFilter(req.scope) },
    include: {
      district: { select: { id: true, name: true, code: true, state: { select: { id: true, name: true, code: true } } } },
      _count: { select: { offices: true } },
    },
  });
  if (!assembly) throw new NotFoundError('Assembly not found');
  res.json({ success: true, data: assembly });
});

const createAssembly = asyncHandler(async (req, res) => {
  const { name, districtId } = req.body;

  const district = await prisma.district.findUnique({ where: { id: districtId } });
  if (!district) throw new ValidationError('districtId does not reference an existing district');

  if (!req.scope.isSuperAdmin) {
    const hasAccess = await prisma.district.findFirst({ where: { id: districtId, ...buildDistrictScopeFilter(req.scope) } });
    if (!hasAccess) throw new ForbiddenError('You can only create assemblies within your assigned scope');
  }

  const assembly = await prisma.assembly.create({ data: { name, districtId } });

  await logAudit({ userId: req.user.userId, action: 'CREATE_LOCATION', metadata: { type: 'assembly', id: assembly.id, name: assembly.name }, req });
  res.status(201).json({ success: true, data: assembly });
});

const updateAssembly = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, districtId, isActive } = req.body;

  const existing = await prisma.assembly.findFirst({ where: { id, ...buildAssemblyScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('Assembly not found or access denied');

  if (districtId) {
    const district = await prisma.district.findUnique({ where: { id: districtId } });
    if (!district) throw new ValidationError('districtId does not reference an existing district');
    if (!req.scope.isSuperAdmin) {
      const hasAccess = await prisma.district.findFirst({ where: { id: districtId, ...buildDistrictScopeFilter(req.scope) } });
      if (!hasAccess) throw new ForbiddenError('You can only assign assemblies to your assigned scope');
    }
  }

  if (isActive === true && existing.isActive === false) {
    const offices = await prisma.office.findMany({ where: { assemblyId: id }, select: { id: true } });
    const officeIds = offices.map((o) => o.id);

    await prisma.$transaction([
      prisma.assembly.update({ where: { id }, data: { isActive: true } }),
      ...(officeIds.length ? [prisma.office.updateMany({ where: { id: { in: officeIds } }, data: { isActive: true } })] : []),
      ...(officeIds.length ? [prisma.camera.updateMany({ where: { officeId: { in: officeIds } }, data: { isActive: true } })] : []),
    ]);

    await logAudit({ userId: req.user.userId, action: 'UPDATE_LOCATION', metadata: { type: 'assembly', id, action: 'reactivated' }, req });
    return res.json({ success: true, data: await prisma.assembly.findUnique({ where: { id } }), message: `Assembly reactivated` });
  }

  const assembly = await prisma.assembly.update({ where: { id }, data: { ...(name !== undefined && { name }), ...(districtId !== undefined && { districtId }), ...(isActive !== undefined && { isActive }) } });
  await logAudit({ userId: req.user.userId, action: 'UPDATE_LOCATION', metadata: { type: 'assembly', id, changes: req.body }, req });
  res.json({ success: true, data: assembly });
});

const deleteAssembly = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.assembly.findFirst({ where: { id, ...buildAssemblyScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('Assembly not found or access denied');

  const offices = await prisma.office.findMany({ where: { assemblyId: id }, select: { id: true } });
  const officeIds = offices.map((o) => o.id);

  const cameras = officeIds.length ? await prisma.camera.findMany({ where: { officeId: { in: officeIds } }, select: { id: true } }) : [];
  const cameraIds = cameras.map((c) => c.id);

  await prisma.$transaction([
    prisma.userScope.deleteMany({ where: { assemblyId: id } }),
    ...(officeIds.length ? [prisma.userScope.deleteMany({ where: { officeId: { in: officeIds } } })] : []),
    ...(cameraIds.length ? [prisma.auditLog.deleteMany({ where: { cameraId: { in: cameraIds } } })] : []),
    prisma.assembly.delete({ where: { id } }),
  ]);

  await logAudit({ userId: req.user.userId, action: 'DELETE_LOCATION', metadata: { type: 'assembly', id, name: existing.name }, req });
  res.json({ success: true, data: { message: `Assembly "${existing.name}" permanently deleted` } });
});


// ============================================================
// OFFICES
// ============================================================

const getOffices = asyncHandler(async (req, res) => {
  const { assemblyId } = req.query;
  const where = {
    ...buildOfficeScopeFilter(req.scope),
    ...(assemblyId && { assemblyId }),
    ...activeFilter(req),
  };
  const offices = await prisma.office.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      assembly: {
        select: {
          id: true, name: true,
          district: { select: { id: true, name: true, code: true, state: { select: { id: true, name: true, code: true } } } },
        },
      },
      _count: { select: { cameras: true } },
    },
  });
  res.json({ success: true, data: offices });
});

const getOfficeById = asyncHandler(async (req, res) => {
  const office = await prisma.office.findFirst({
    where: { id: req.params.id, ...buildOfficeScopeFilter(req.scope) },
    include: {
      assembly: {
        select: {
          id: true, name: true,
          district: { select: { id: true, name: true, code: true, state: { select: { id: true, name: true, code: true } } } },
        },
      },
      _count: { select: { cameras: true } },
    },
  });
  if (!office) throw new NotFoundError('Office not found');
  res.json({ success: true, data: office });
});

const createOffice = asyncHandler(async (req, res) => {
  const { name, address, assemblyId } = req.body;

  const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } });
  if (!assembly) throw new ValidationError('assemblyId does not reference an existing assembly');

  if (!req.scope.isSuperAdmin) {
    const hasAccess = await prisma.assembly.findFirst({ where: { id: assemblyId, ...buildAssemblyScopeFilter(req.scope) } });
    if (!hasAccess) throw new ForbiddenError('You can only create offices within your assigned scope');
  }

  const office = await prisma.office.create({ data: { name, address, assemblyId } });

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_LOCATION',
    metadata: { type: 'office', id: office.id, name: office.name },
    req,
  });

  res.status(201).json({ success: true, data: office });
});

const updateOffice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, address, assemblyId, isActive } = req.body;

  const existing = await prisma.office.findFirst({ where: { id, ...buildOfficeScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('Office not found or access denied');

  if (assemblyId) {
    const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } });
    if (!assembly) throw new ValidationError('assemblyId does not reference an existing assembly');
    if (!req.scope.isSuperAdmin) {
      const hasAccess = await prisma.assembly.findFirst({ where: { id: assemblyId, ...buildAssemblyScopeFilter(req.scope) } });
      if (!hasAccess) throw new ForbiddenError('You can only assign offices to your assigned scope');
    }
  }

  // ---- CASCADE REACTIVATE ----
  if (isActive === true && existing.isActive === false) {
    await prisma.$transaction([
      prisma.office.update({ where: { id }, data: { isActive: true } }),
      prisma.camera.updateMany({ where: { officeId: id }, data: { isActive: true } }),
    ]);

    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE_LOCATION',
      metadata: { type: 'office', id, action: 'reactivated' },
      req,
    });

    const updated = await prisma.office.findUnique({ where: { id } });
    return res.json({
      success: true,
      data: updated,
      message: `Office reactivated along with its cameras`,
    });
  }

  const office = await prisma.office.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(assemblyId !== undefined && { assemblyId }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_LOCATION',
    metadata: { type: 'office', id, changes: req.body },
    req,
  });

  res.json({ success: true, data: office });
});

const deleteOffice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.office.findFirst({ where: { id, ...buildOfficeScopeFilter(req.scope) } });
  if (!existing) throw new NotFoundError('Office not found or access denied');

  const cameras = await prisma.camera.findMany({ where: { officeId: id }, select: { id: true } });
  const cameraIds = cameras.map((c) => c.id);

  await prisma.$transaction([
    prisma.userScope.deleteMany({ where: { officeId: id } }),
    ...(cameraIds.length ? [prisma.auditLog.deleteMany({ where: { cameraId: { in: cameraIds } } })] : []),
    prisma.office.delete({ where: { id } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: { type: 'office', id, name: existing.name },
    req,
  });

  res.json({
    success: true,
    data: { message: `Office "${existing.name}" permanently deleted` },
  });
});

// ============================================================
// TREE
// ============================================================

const getLocationTree = asyncHandler(async (req, res) => {
  const states = await prisma.state.findMany({
    where: { ...buildStateScopeFilter(req.scope), isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, code: true,
      districts: {
        where: { ...buildDistrictScopeFilter(req.scope), isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, code: true,
          assemblies: {
            where: { ...buildAssemblyScopeFilter(req.scope), isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true, name: true,
              offices: {
                where: { ...buildOfficeScopeFilter(req.scope), isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, address: true, _count: { select: { cameras: true } } }
              }
            }
          }
        },
      },
    },
  });
  res.json({ success: true, data: states });
});

module.exports = {
  getStates, getStateById, createState, updateState, deleteState,
  getDistricts, getDistrictById, createDistrict, updateDistrict, deleteDistrict,
  getAssemblies, getAssemblyById, createAssembly, updateAssembly, deleteAssembly,
  getOffices, getOfficeById, createOffice, updateOffice, deleteOffice,
  getLocationTree,
};
