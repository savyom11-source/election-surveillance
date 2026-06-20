// ============================================================
// LOCATION CONTROLLER — States / Districts / Offices CRUD
// With CASCADE soft-delete:
//   Deactivate State   → deactivates all its Districts, Offices, Cameras
//   Deactivate District → deactivates all its Offices, Cameras
//   Deactivate Office  → deactivates all its Cameras
// ============================================================

const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, ValidationError, asyncHandler } = require('../utils/errors');
const { logAudit } = require('../services/audit.service');
const {
  buildStateScopeFilter,
  buildDistrictScopeFilter,
  buildOfficeScopeFilter,
} = require('../middleware/rbac');

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
  const { name, code, isActive } = req.body;

  const existing = await prisma.state.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('State not found');

  if (name || code) {
    const conflict = await prisma.state.findFirst({
      where: { id: { not: id }, OR: [...(name ? [{ name }] : []), ...(code ? [{ code }] : [])] },
    });
    if (conflict) throw new ConflictError('A state with this name or code already exists');
  }

  const state = await prisma.state.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(isActive !== undefined && { isActive }),
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

  // ---- CASCADE SOFT DELETE ----
  // 1. Find all district IDs under this state
  const districts = await prisma.district.findMany({
    where: { stateId: id },
    select: { id: true },
  });
  const districtIds = districts.map((d) => d.id);

  // 2. Find all office IDs under those districts
  const offices = districtIds.length
    ? await prisma.office.findMany({
        where: { districtId: { in: districtIds } },
        select: { id: true },
      })
    : [];
  const officeIds = offices.map((o) => o.id);

  // 3. Deactivate all in a single transaction
  await prisma.$transaction([
    // Deactivate all cameras under those offices
    ...(officeIds.length
      ? [prisma.camera.updateMany({ where: { officeId: { in: officeIds } }, data: { isActive: false } })]
      : []),
    // Deactivate all offices under those districts
    ...(officeIds.length
      ? [prisma.office.updateMany({ where: { id: { in: officeIds } }, data: { isActive: false } })]
      : []),
    // Deactivate all districts under this state
    ...(districtIds.length
      ? [prisma.district.updateMany({ where: { id: { in: districtIds } }, data: { isActive: false } })]
      : []),
    // Deactivate the state itself
    prisma.state.update({ where: { id }, data: { isActive: false } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: {
      type: 'state', id,
      name: existing.name,
      cascadeDeactivated: {
        districts: districtIds.length,
        offices: officeIds.length,
      },
    },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `State "${existing.name}" deactivated along with ${districtIds.length} district(s) and ${officeIds.length} office(s)`,
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
      _count: { select: { offices: true } },
    },
  });
  res.json({ success: true, data: districts });
});

const getDistrictById = asyncHandler(async (req, res) => {
  const district = await prisma.district.findFirst({
    where: { id: req.params.id, ...buildDistrictScopeFilter(req.scope) },
    include: {
      state: { select: { id: true, name: true, code: true } },
      _count: { select: { offices: true } },
    },
  });
  if (!district) throw new NotFoundError('District not found');
  res.json({ success: true, data: district });
});

const createDistrict = asyncHandler(async (req, res) => {
  const { name, code, stateId } = req.body;

  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) throw new ValidationError('stateId does not reference an existing state');

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

  const existing = await prisma.district.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('District not found');

  if (stateId) {
    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) throw new ValidationError('stateId does not reference an existing state');
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

  const existing = await prisma.district.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('District not found');

  // ---- CASCADE SOFT DELETE ----
  // 1. Find all office IDs under this district
  const offices = await prisma.office.findMany({
    where: { districtId: id },
    select: { id: true },
  });
  const officeIds = offices.map((o) => o.id);

  await prisma.$transaction([
    // Deactivate all cameras under those offices
    ...(officeIds.length
      ? [prisma.camera.updateMany({ where: { officeId: { in: officeIds } }, data: { isActive: false } })]
      : []),
    // Deactivate all offices
    ...(officeIds.length
      ? [prisma.office.updateMany({ where: { id: { in: officeIds } }, data: { isActive: false } })]
      : []),
    // Deactivate the district itself
    prisma.district.update({ where: { id }, data: { isActive: false } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: {
      type: 'district', id,
      name: existing.name,
      cascadeDeactivated: { offices: officeIds.length },
    },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `District "${existing.name}" deactivated along with ${officeIds.length} office(s)`,
    },
  });
});

// ============================================================
// OFFICES
// ============================================================

const getOffices = asyncHandler(async (req, res) => {
  const { districtId } = req.query;
  const where = {
    ...buildOfficeScopeFilter(req.scope),
    ...(districtId && { districtId }),
    ...activeFilter(req),
  };
  const offices = await prisma.office.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      district: {
        select: {
          id: true, name: true, code: true,
          state: { select: { id: true, name: true, code: true } },
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
      district: {
        select: {
          id: true, name: true, code: true,
          state: { select: { id: true, name: true, code: true } },
        },
      },
      _count: { select: { cameras: true } },
    },
  });
  if (!office) throw new NotFoundError('Office not found');
  res.json({ success: true, data: office });
});

const createOffice = asyncHandler(async (req, res) => {
  const { name, address, districtId } = req.body;

  const district = await prisma.district.findUnique({ where: { id: districtId } });
  if (!district) throw new ValidationError('districtId does not reference an existing district');

  const office = await prisma.office.create({ data: { name, address, districtId } });

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
  const { name, address, districtId, isActive } = req.body;

  const existing = await prisma.office.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Office not found');

  if (districtId) {
    const district = await prisma.district.findUnique({ where: { id: districtId } });
    if (!district) throw new ValidationError('districtId does not reference an existing district');
  }

  const office = await prisma.office.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(districtId !== undefined && { districtId }),
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

  const existing = await prisma.office.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Office not found');

  // ---- CASCADE SOFT DELETE ----
  await prisma.$transaction([
    // Deactivate all cameras under this office
    prisma.camera.updateMany({ where: { officeId: id }, data: { isActive: false } }),
    // Deactivate the office itself
    prisma.office.update({ where: { id }, data: { isActive: false } }),
  ]);

  // Count cameras deactivated for response message
  const cameraCount = await prisma.camera.count({ where: { officeId: id } });

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_LOCATION',
    metadata: { type: 'office', id, name: existing.name },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `Office "${existing.name}" deactivated along with its cameras`,
    },
  });
});

// ============================================================
// TREE — full hierarchy filtered to user scope
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
          offices: {
            where: { ...buildOfficeScopeFilter(req.scope), isActive: true },
            orderBy: { name: 'asc' },
            select: {
              id: true, name: true, address: true,
              _count: { select: { cameras: true } },
            },
          },
        },
      },
    },
  });
  res.json({ success: true, data: states });
});

module.exports = {
  getStates, getStateById, createState, updateState, deleteState,
  getDistricts, getDistrictById, createDistrict, updateDistrict, deleteDistrict,
  getOffices, getOfficeById, createOffice, updateOffice, deleteOffice,
  getLocationTree,
};
