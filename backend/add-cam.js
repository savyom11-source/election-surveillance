const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addCamera() {
  try {
    // Find Kota South Office
    const office = await prisma.office.findFirst({
      where: { name: 'Kota South Polling Station' }
    });

    if (!office) {
      console.log('Office not found!');
      return;
    }

    const cam = await prisma.camera.create({
      data: {
        name: 'TEST_CAMERA1',
        description: 'Covers main voting area',
        streamUrl: 'rtmp://13.201.193.98:1935/live/RDNL0136',
        streamType: 'RTMP',
        status: 'ACTIVE',
        officeId: office.id,
      }
    });
    console.log('SUCCESS:', cam.id);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

addCamera();
