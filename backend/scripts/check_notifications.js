require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const since = new Date(Date.now() - 1000 * 60 * 10); // last 10 minutes
  const notifs = await Notification.find({
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 }).limit(50).lean();
  console.log('found', notifs.length);
  notifs.forEach(n => console.log(n));
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
