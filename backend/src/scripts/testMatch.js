const { Lead } = require('../../dist/models/Lead');

async function testMatch() {
  const orgId = '5f372322-01cf-427f-acf9-8034f1c35f09';
  const norm = '7065218879';
  try {
    const match = await Lead.findOne({
      organizationId: orgId,
      isDeleted: false,
      $or: [
        { phone: { $regex: norm } },
        { whatsApp: { $regex: norm } },
        { alternatePhone: { $regex: norm } }
      ]
    });
    console.log('Match result with $or:', match ? { id: match.id, name: match.name, phone: match.phone } : 'NULL');
  } catch (err) {
    console.error('Error in findOne:', err);
  }
}

testMatch().then(() => process.exit(0));
