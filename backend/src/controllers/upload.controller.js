// ============================================================
// UPLOAD CONTROLLER — Bulk Camera Import
// ============================================================

const xlsx = require('xlsx');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { asyncHandler, ValidationError } = require('../utils/errors');
const { logAudit } = require('../services/audit.service');

function cleanString(str) {
  if (!str) return '';
  return str.toString().trim();
}

function generateCode(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10);
}

const bulkUploadCameras = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No Excel file provided');
  }

  // Parse Excel file from buffer
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  // Header expects: Sr.No, State, District, Polling booth name/ Assembly name, IN/OUT, RTMP/RTSP, IDs
  const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (data.length === 0) {
    throw new ValidationError('The Excel file is empty');
  }

  let successCount = 0;
  const errors = [];

  // Determine media server base URL (remove trailing slash if present)
  let mediaMtxServer = env.mediaMtx.server || 'http://localhost:8888';
  // Strip protocol to just get host/port (e.g. localhost:8888)
  mediaMtxServer = mediaMtxServer.replace(/^https?:\/\//, '').replace(/\/$/, '');
  // Default to 1935 if not specified, but typically just host
  const host = mediaMtxServer.split(':')[0];

  // Process rows sequentially to avoid race conditions with create/upsert
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header

    try {
      // Find keys dynamically allowing for slight column name variations
      const keys = Object.keys(row);
      
      const getVal = (keywords) => {
        const key = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
        return key ? cleanString(row[key]) : '';
      };

      const stateName    = getVal(['state']);
      const districtName = getVal(['district']);
      const officeName   = getVal(['polling', 'assembly', 'office']);
      const inOut        = getVal(['in/out', 'placement']);
      const protocolStr  = getVal(['rtmp', 'rtsp', 'protocol']);
      const streamId     = getVal(['id', 'stream']);
      let cameraName     = getVal(['camera name', 'name']);

      if (!stateName || !districtName || !officeName || !streamId) {
        errors.push(`Row ${rowNum}: Missing required fields (State, District, Assembly, or ID)`);
        continue;
      }

      // Default camera name if not provided
      if (!cameraName) {
        cameraName = `${officeName} - ${inOut || 'Main'} Camera`;
      }

      // Upsert State
      let state = await prisma.state.findFirst({
        where: { name: { equals: stateName, mode: 'insensitive' } }
      });
      if (!state) {
        state = await prisma.state.create({
          data: { name: stateName, code: generateCode(stateName) }
        });
      }

      // Upsert District
      let district = await prisma.district.findFirst({
        where: { 
          stateId: state.id, 
          name: { equals: districtName, mode: 'insensitive' } 
        }
      });
      if (!district) {
        district = await prisma.district.create({
          data: { name: districtName, code: generateCode(districtName), stateId: state.id }
        });
      }

      // Upsert Office
      let office = await prisma.office.findFirst({
        where: {
          districtId: district.id,
          name: { equals: officeName, mode: 'insensitive' }
        }
      });
      if (!office) {
        office = await prisma.office.create({
          data: { name: officeName, districtId: district.id }
        });
      }

      // Determine Protocol & streamUrl
      const isRtsp = protocolStr.toLowerCase().includes('rtsp');
      const streamType = isRtsp ? 'RTSP' : 'RTMP';
      
      let streamUrl = streamId;
      // If it doesn't already have a protocol, prepend it
      if (!streamUrl.toLowerCase().startsWith('rtmp') && !streamUrl.toLowerCase().startsWith('rtsp')) {
        const cleanId = streamId.replace(/^\//, ''); // remove leading slash
        if (isRtsp) {
          streamUrl = `rtsp://${host}:8554/${cleanId}`;
        } else {
          streamUrl = `rtmp://${host}:1935/${cleanId}`;
        }
      }

      let placementVal = null;
      if (inOut) {
        const inOutLower = inOut.toLowerCase();
        if (inOutLower.includes('in')) placementVal = 'INSIDE';
        else if (inOutLower.includes('out')) placementVal = 'OUTSIDE';
      }

      // Create Camera
      await prisma.camera.create({
        data: {
          name: cameraName,
          description: null,
          streamUrl,
          streamType,
          placement: placementVal,
          officeId: office.id,
          status: 'ACTIVE'
        }
      });

      successCount++;
    } catch (error) {
      console.error(`Bulk upload error at row ${rowNum}:`, error);
      errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_CAMERA',
    metadata: { bulkUpload: true, totalProcessed: data.length, successCount, errorCount: errors.length },
    req,
  });

  res.json({
    success: true,
    data: {
      message: `Successfully imported ${successCount} cameras.`,
      successCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    }
  });
});

module.exports = {
  bulkUploadCameras
};
