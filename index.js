// index.js (Main File)
import express from 'express';
import { Client, middleware } from '@line/bot-sdk';
import dotenv from 'dotenv';

// Import Features
import { detectSpam } from './features/spamGuard.js';
import { handleGroupEvents } from './features/groupManager.js';
import { handleAdminCommands } from './features/commander.js';

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new Client(config);
const app = express();

// --- Main Event Handler ---
async function handleEvent(event) {
  try {
    // 1. ตรวจสอบ Event ประเภทกลุ่ม (เข้า/ออก)
    // ส่ง client ไปด้วยเพื่อให้ฟีเจอร์ต่างๆ ตอบกลับได้
    const isGroupEvent = await handleGroupEvents(event, client);
    if (isGroupEvent) return; 

    // 2. ถ้าเป็นข้อความ -> เช็คคำสั่ง Admin & สแปม
    if (event.type === 'message' && event.message.type === 'text') {
      
      // 2.1 👑 เช็คคำสั่ง Admin ก่อนเสมอ (Priority สูงสุด)
      const isAdminCmd = await handleAdminCommands(event, client);
      if (isAdminCmd) return; 

      // 2.2 ตรวจจับสแปม
      const isSpam = await detectSpam(event, client);
      if (isSpam) return;

      // 2.3 (Optional) Logic อื่นๆ เช่น บอทคุยเล่น
      // if (event.message.text === 'ping') ...
    }
  } catch (err) {
    console.error("Error in handleEvent:", err);
  }

  return Promise.resolve(null);
}

// --- Server Setup ---
app.post('/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

const port = process.env.PORT || 8080; // Cloud Run ชอบ Port 8080
app.listen(port, () => {
  console.log(`🚀 Cloud Bot Started! Listening on port ${port}`);
});