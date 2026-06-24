import { PrismaClient, Role, StreamStatus, StreamType } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@election-surveillance.in' },
    update: {},
    create: { name: 'Super Administrator', email: 'admin@election-surveillance.in', passwordHash, role: Role.SUPER_ADMIN, isActive: true },
  });
  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  const rajasthan = await prisma.state.upsert({
    where: { code: 'RJ' }, update: {},
    create: { name: 'Rajasthan', code: 'RJ', isActive: true },
  });
  console.log(`✅ State: ${rajasthan.name}`);

  const kota = await prisma.district.upsert({
    where: { stateId_code: { stateId: rajasthan.id, code: 'KOTA' } }, update: {},
    create: { name: 'Kota', code: 'KOTA', stateId: rajasthan.id, isActive: true },
  });
  console.log(`✅ District: ${kota.name}`);

  const office1 = await prisma.office.upsert({
    where: { id: 'seed-office-001' }, update: {},
    create: { id: 'seed-office-001', name: 'Kota North Polling Station', address: 'Ward 1, Kota North, Rajasthan', districtId: kota.id, isActive: true },
  });
  const office2 = await prisma.office.upsert({
    where: { id: 'seed-office-002' }, update: {},
    create: { id: 'seed-office-002', name: 'Kota South Polling Station', address: 'Ward 5, Kota South, Rajasthan', districtId: kota.id, isActive: true },
  });
  console.log(`✅ Offices: ${office1.name}, ${office2.name}`);

  const cams = [
    { id: 'seed-cam-001', name: 'Main Hall - Cam 1',    description: 'Covers main entrance and voting booths', streamUrl: 'rtmp://swastik.kcslivestream.com:1935/live/RDNL3117', officeId: office1.id },
    { id: 'seed-cam-002', name: 'Main Hall - Cam 2',    description: 'Covers ballot counting area',            streamUrl: 'rtmp://swastik.kcslivestream.com:1935/live/RDNL3118', officeId: office1.id },
    { id: 'seed-cam-003', name: 'Entry Gate - Cam 1',   description: 'Covers main entry gate',                 streamUrl: 'rtmp://swastik.kcslivestream.com:1935/live/RDNL3119', officeId: office2.id },
    { id: 'seed-cam-004', name: 'Counting Room - Cam 1',description: 'Covers vote counting room',              streamUrl: 'rtmp://swastik.kcslivestream.com:1935/live/RDNL3120', officeId: office2.id },
  ];

  for (const cam of cams) {
    await prisma.camera.upsert({
      where: { id: cam.id }, update: {},
      create: { ...cam, streamType: StreamType.RTMP, status: StreamStatus.ACTIVE },
    });
  }
  console.log(`✅ 4 sample cameras seeded with RTMP URLs`);

  const roleHash = await bcrypt.hash('Observer@1234', 12);
  const stateAdmin = await prisma.user.upsert({
    where: { email: 'rj.admin@election-surveillance.in' }, update: {},
    create: { name: 'Rajasthan State Admin', email: 'rj.admin@election-surveillance.in', passwordHash: roleHash, role: Role.STATE_ADMIN, isActive: true, createdById: superAdmin.id },
  });
  await prisma.userScope.upsert({ where: { userId_stateId: { userId: stateAdmin.id, stateId: rajasthan.id } }, update: {}, create: { userId: stateAdmin.id, stateId: rajasthan.id } });
  console.log(`✅ State Admin: ${stateAdmin.email}`);

  const distObs = await prisma.user.upsert({
    where: { email: 'kota.observer@election-surveillance.in' }, update: {},
    create: { name: 'Kota District Observer', email: 'kota.observer@election-surveillance.in', passwordHash: roleHash, role: Role.DISTRICT_OBSERVER, isActive: true, createdById: superAdmin.id },
  });
  await prisma.userScope.upsert({ where: { userId_districtId: { userId: distObs.id, districtId: kota.id } }, update: {}, create: { userId: distObs.id, districtId: kota.id } });
  console.log(`✅ District Observer: ${distObs.email}`);

  const offObs = await prisma.user.upsert({
    where: { email: 'kotanorth.observer@election-surveillance.in' }, update: {},
    create: { name: 'Kota North Office Observer', email: 'kotanorth.observer@election-surveillance.in', passwordHash: roleHash, role: Role.OFFICE_OBSERVER, isActive: true, createdById: superAdmin.id },
  });
  await prisma.userScope.upsert({ where: { userId_officeId: { userId: offObs.id, officeId: office1.id } }, update: {}, create: { userId: offObs.id, officeId: office1.id } });
  console.log(`✅ Office Observer: ${offObs.email}`);

  console.log('\n🎉 Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Super Admin : admin@election-surveillance.in / Admin@1234');
  console.log('  State Admin : rj.admin@election-surveillance.in / Observer@1234');
  console.log('  District Obs: kota.observer@election-surveillance.in / Observer@1234');
  console.log('  Office Obs  : kotanorth.observer@election-surveillance.in / Observer@1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
