// ============================================================
// SEED FILE — Initial data for Election Surveillance Platform
// Run: npx prisma db seed
// ============================================================

import { PrismaClient, Role, StreamStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ----------------------------------------------------------
  // 1. SUPER ADMIN USER
  // ----------------------------------------------------------
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@election-surveillance.in' },
    update: {},
    create: {
      name: 'Super Administrator',
      email: 'admin@election-surveillance.in',
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // ----------------------------------------------------------
  // 2. SAMPLE LOCATION HIERARCHY
  //    Rajasthan → Kota District → 2 Offices → 2 Cameras each
  // ----------------------------------------------------------

  const rajasthan = await prisma.state.upsert({
    where: { code: 'RJ' },
    update: {},
    create: {
      name: 'Rajasthan',
      code: 'RJ',
      isActive: true,
    },
  });
  console.log(`✅ State: ${rajasthan.name}`);

  const kota = await prisma.district.upsert({
    where: { stateId_code: { stateId: rajasthan.id, code: 'KOTA' } },
    update: {},
    create: {
      name: 'Kota',
      code: 'KOTA',
      stateId: rajasthan.id,
      isActive: true,
    },
  });
  console.log(`✅ District: ${kota.name}`);

  const office1 = await prisma.office.upsert({
    where: { id: 'seed-office-001' },
    update: {},
    create: {
      id: 'seed-office-001',
      name: 'Kota North Polling Station',
      address: 'Ward 1, Kota North, Rajasthan',
      districtId: kota.id,
      isActive: true,
    },
  });

  const office2 = await prisma.office.upsert({
    where: { id: 'seed-office-002' },
    update: {},
    create: {
      id: 'seed-office-002',
      name: 'Kota South Polling Station',
      address: 'Ward 5, Kota South, Rajasthan',
      districtId: kota.id,
      isActive: true,
    },
  });
  console.log(`✅ Offices: ${office1.name}, ${office2.name}`);

  // Cameras for Office 1
  await prisma.camera.upsert({
    where: { id: 'seed-cam-001' },
    update: {},
    create: {
      id: 'seed-cam-001',
      name: 'Main Hall - Cam 1',
      description: 'Covers main entrance and voting booths',
      rtspUrl: 'rtsp://192.168.1.101:554/stream1',
      hlsUrl: 'http://media-server:8080/hls/cam-001/index.m3u8',
      status: StreamStatus.ACTIVE,
      officeId: office1.id,
    },
  });

  await prisma.camera.upsert({
    where: { id: 'seed-cam-002' },
    update: {},
    create: {
      id: 'seed-cam-002',
      name: 'Main Hall - Cam 2',
      description: 'Covers ballot counting area',
      rtspUrl: 'rtsp://192.168.1.102:554/stream1',
      hlsUrl: 'http://media-server:8080/hls/cam-002/index.m3u8',
      status: StreamStatus.ACTIVE,
      officeId: office1.id,
    },
  });

  // Cameras for Office 2
  await prisma.camera.upsert({
    where: { id: 'seed-cam-003' },
    update: {},
    create: {
      id: 'seed-cam-003',
      name: 'Entry Gate - Cam 1',
      description: 'Covers main entry gate',
      rtspUrl: 'rtsp://192.168.1.103:554/stream1',
      hlsUrl: 'http://media-server:8080/hls/cam-003/index.m3u8',
      status: StreamStatus.ACTIVE,
      officeId: office2.id,
    },
  });

  await prisma.camera.upsert({
    where: { id: 'seed-cam-004' },
    update: {},
    create: {
      id: 'seed-cam-004',
      name: 'Counting Room - Cam 1',
      description: 'Covers vote counting room',
      rtspUrl: 'rtsp://192.168.1.104:554/stream1',
      hlsUrl: 'http://media-server:8080/hls/cam-004/index.m3u8',
      status: StreamStatus.ACTIVE,
      officeId: office2.id,
    },
  });
  console.log(`✅ 4 sample cameras seeded`);

  // ----------------------------------------------------------
  // 3. SAMPLE USERS FOR EACH ROLE
  // ----------------------------------------------------------
  const roleHash = await bcrypt.hash('Observer@1234', 12);

  const stateAdmin = await prisma.user.upsert({
    where: { email: 'rj.admin@election-surveillance.in' },
    update: {},
    create: {
      name: 'Rajasthan State Admin',
      email: 'rj.admin@election-surveillance.in',
      passwordHash: roleHash,
      role: Role.STATE_ADMIN,
      isActive: true,
      createdById: superAdmin.id,
    },
  });

  // Scope: Rajasthan state
  await prisma.userScope.upsert({
    where: { userId_stateId: { userId: stateAdmin.id, stateId: rajasthan.id } },
    update: {},
    create: { userId: stateAdmin.id, stateId: rajasthan.id },
  });
  console.log(`✅ State Admin: ${stateAdmin.email}`);

  const districtObserver = await prisma.user.upsert({
    where: { email: 'kota.observer@election-surveillance.in' },
    update: {},
    create: {
      name: 'Kota District Observer',
      email: 'kota.observer@election-surveillance.in',
      passwordHash: roleHash,
      role: Role.DISTRICT_OBSERVER,
      isActive: true,
      createdById: superAdmin.id,
    },
  });

  // Scope: Kota district
  await prisma.userScope.upsert({
    where: { userId_districtId: { userId: districtObserver.id, districtId: kota.id } },
    update: {},
    create: { userId: districtObserver.id, districtId: kota.id },
  });
  console.log(`✅ District Observer: ${districtObserver.email}`);

  const officeObserver = await prisma.user.upsert({
    where: { email: 'kotanorth.observer@election-surveillance.in' },
    update: {},
    create: {
      name: 'Kota North Office Observer',
      email: 'kotanorth.observer@election-surveillance.in',
      passwordHash: roleHash,
      role: Role.OFFICE_OBSERVER,
      isActive: true,
      createdById: superAdmin.id,
    },
  });

  // Scope: Office 1 only
  await prisma.userScope.upsert({
    where: { userId_officeId: { userId: officeObserver.id, officeId: office1.id } },
    update: {},
    create: { userId: officeObserver.id, officeId: office1.id },
  });
  console.log(`✅ Office Observer: ${officeObserver.email}`);

  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Default credentials:');
  console.log('  Super Admin : admin@election-surveillance.in  / Admin@1234');
  console.log('  State Admin : rj.admin@election-surveillance.in / Observer@1234');
  console.log('  District Obs: kota.observer@election-surveillance.in / Observer@1234');
  console.log('  Office Obs  : kotanorth.observer@election-surveillance.in / Observer@1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
