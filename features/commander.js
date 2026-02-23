// features/commander.js
// --------------------------------------------------------
// 🛠️ ระบบรับคำสั่ง (ฉบับแก้: รักษารูปแบบบรรทัด/วรรค เป๊ะ 100%)
// --------------------------------------------------------

import { getSpamStats, resetSpamState } from './spamGuard.js';
import { getGroupConfig, updateGroupConfig, isGroupAdmin } from './storage.js';

// ⚠️ ใส่ LINE User ID ของคุณ (เจ้าของบอท)
const MASTER_ADMIN_ID = "Ucfae2cabe1ffc8a51de33edfdb178101"; 

export async function handleAdminCommands(event, client) {
  const userId = event.source.userId;
  const groupId = event.source.groupId;
  const fullText = event.message.text; // ไม่ใช้ .trim() ตรงนี้ เพราะเดี๋ยววรรคหน้าหาย

  // ต้องขึ้นต้นด้วย /
  if (!fullText.startsWith('/')) return false;

  // -----------------------------------------------------------
  // ✂️ ส่วนสำคัญ: ตัดคำสั่งแบบรักษารูปแบบข้อความ (New Logic)
  // -----------------------------------------------------------
  // หาช่องว่างแรก เพื่อแยก "คำสั่ง" กับ "เนื้อหา"
  const firstSpaceIndex = fullText.indexOf(' ');
  
  let command = '';
  let contentBody = '';

  if (firstSpaceIndex === -1) {
    // กรณีพิมพ์คำสั่งโดดๆ เช่น "/status" (ไม่มีเนื้อหาตามหลัง)
    command = fullText.slice(1).toLowerCase();
  } else {
    // กรณีมีเนื้อหา เช่น "/setwelcome สวัสดี \n ข้อ 1..."
    command = fullText.slice(1, firstSpaceIndex).toLowerCase(); // ตัดเอาคำสั่ง
    contentBody = fullText.slice(firstSpaceIndex + 1); // เนื้อหาข้างหลัง เอามาหมดรวมถึง Enter
  }
  // -----------------------------------------------------------

  // คำสั่งตรวจสอบ ID ตัวเอง (ใครก็ใช้ได้)
  if (command === 'uid' || command === 'id') {
    await client.replyMessage(event.replyToken, { type: 'text', text: `🆔 ID ของคุณ:\n${userId}` });
    return true;
  }

  // --- โซนคำสั่งสำหรับ Admin เท่านั้น ---
  if (!groupId) return false; 
  
  const isAdmin = await isGroupAdmin(groupId, userId, MASTER_ADMIN_ID);
  if (!isAdmin) return false;

  const config = await getGroupConfig(groupId); 
  let replyText = '';

  try {
    switch (command) {
      // 1. ตั้งแอดมินกลุ่ม
      case 'addadmin':
        const newAdminId = contentBody.trim(); // ตัดช่องว่างหน้าหลังเฉพาะ ID
        if (!newAdminId.startsWith('U')) {
          replyText = '❌ UserID ไม่ถูกต้อง';
        } else {
          if (!config.admins.includes(newAdminId)) {
            config.admins.push(newAdminId);
            await updateGroupConfig(groupId, config); 
            replyText = `✅ แต่งตั้ง Admin เพิ่มเรียบร้อย`;
          } else {
            replyText = '⚠️ เป็น Admin อยู่แล้ว';
          }
        }
        break;

      case 'deladmin':
         const targetId = contentBody.trim();
         config.admins = config.admins.filter(id => id !== targetId);
         await updateGroupConfig(groupId, config);
         replyText = `🗑️ ลบ Admin เรียบร้อย`;
         break;

      // 2. เปิด/ปิด ฟีเจอร์
      case 'welcome':
      case 'spam':
      case 'ต้อนรับ':
      case 'กันสแปม':
        const mode = contentBody.trim().toLowerCase();
        // แปลงคำสั่งไทยเป็นอังกฤษ
        let key = (command === 'welcome' || command === 'ต้อนรับ') ? 'welcome' : 'spam';
        
        if (mode === 'on' || mode === 'เปิด') {
          config.features[key] = true;
          replyText = `🟢 เปิดระบบเรียบร้อย`;
        } else if (mode === 'off' || mode === 'ปิด') {
          config.features[key] = false;
          replyText = `🔴 ปิดระบบเรียบร้อย`;
        } else {
          replyText = `❓ พิมพ์ เปิด หรือ ปิด`;
        }
        await updateGroupConfig(groupId, config);
        break;

      // ====================================================
      // 3. ตั้งข้อความต้อนรับ (ไฮไลท์สำคัญ!)
      // ====================================================
      case 'setwelcome':
      case 'ตั้งข้อความ':
        if (!contentBody) {
          replyText = `⚠️ กรุณาพิมพ์ข้อความตามหลังคำสั่ง เช่น:\n/setwelcome ข้อ 1...\nข้อ 2...`;
        } else {
          // บันทึก contentBody ลงไปตรงๆ เลย (รักษารูปแบบเดิม 100%)
          config.welcomeMsg = contentBody;
          await updateGroupConfig(groupId, config);
          replyText = `✅ บันทึกข้อความต้อนรับใหม่แล้ว (รูปแบบตามที่คุณพิมพ์)`;
        }
        break;

      case 'config':
        replyText = `⚙️ ตั้งค่า:\nต้อนรับ: ${config.features.welcome ? 'On' : 'Off'}\nกันสแปม: ${config.features.spam ? 'On' : 'Off'}`;
        break;

      case 'status':
        const stats = getSpamStats();
        replyText = `📊 Monitoring: ${stats.monitoredUsers} users`;
        break;

      case 'help':
        replyText = `🛠️ คำสั่ง:\n/setwelcome [ข้อความ] - ตั้งคำต้อนรับ (รองรับเว้นบรรทัด)\n/ต้อนรับ เปิด/ปิด\n/กันสแปม เปิด/ปิด\n/addadmin [ID]`;
        break;

      default:
        return false;
    }

    if (replyText) {
      await client.replyMessage(event.replyToken, { type: 'text', text: replyText });
    }
    return true;

  } catch (error) {
    console.error('Command Error:', error);
    return false;
  }
}