// ============================================================
// VALIDATORS — Location hierarchy schemas (States/Districts/Offices)
// ============================================================

const { z } = require('zod');

const uuid = z.string().uuid('Invalid ID format');

// ---- States ----
const createStateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(10).transform((s) => s.toUpperCase()),
});

const updateStateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).transform((s) => s.toUpperCase()).optional(),
  isActive: z.boolean().optional(),
});

// ---- Districts ----
const createDistrictSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').max(20).transform((s) => s.toUpperCase()),
  stateId: uuid,
});

const updateDistrictSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(20).transform((s) => s.toUpperCase()).optional(),
  stateId: uuid.optional(),
  isActive: z.boolean().optional(),
});

// ---- Offices ----
const createOfficeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().optional(),
  districtId: uuid,
});

const updateOfficeSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  districtId: uuid.optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createStateSchema,
  updateStateSchema,
  createDistrictSchema,
  updateDistrictSchema,
  createOfficeSchema,
  updateOfficeSchema,
};
