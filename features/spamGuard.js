import { getGroupConfig, isGroupAdmin } from './storage.js';
// --------------------------------------------------------
// 🛡️ ระบบป้องกันสแปมและตรวจจับโปรแกรมช่วยเล่น
// --------------------------------------------------------

const userState = new Map(); // เก็บข้อมูล User ภายในไฟล์นี้

// ตั้งค่าความไวในการจับผิด
const SETTINGS = {
  TIME_WINDOW_MS: 1000,
  RATE_LIMIT_THRESHOLD: 3,     // 5 ข้อความ/วินาที = Spam
  CONSISTENCY_CHECK_COUNT: 3,
  MAX_TIMING_DEVIATION_MS: 30, // นิ่งเกิน = Bot
  MIN_SPEED_GAP_MS: 100,       // เร็วเกินมนุษย์ = Macro
  COOLDOWN_MS: 5000,
  MEMORY_CLEANUP_MS: 60000,
  DATA_RETENTION_MS: 300000
};

// ฟังก์ชันคำนวณความนิ่ง (SD)
function calculateTimingConsistency(timestamps) {
  if (timestamps.length < 2) return null;
  const deltas = [];
  for (let i = 1; i < timestamps.length; i++) {
    deltas.push(timestamps[i] - timestamps[i - 1]);
  }
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((sum, delta) => sum + Math.pow(delta - mean, 2), 0) / deltas.length;
  return Math.sqrt(variance);
}

// --------------------------------------------------------
// Function หลักที่จะส่งออกไปให้ index.js เรียกใช้
// --------------------------------------------------------
export async function detectSpam(event, client) {
  // เช็คเบื้องต้น: ต้องเป็นข้อความในกลุ่มเท่านั้น
  if (event.type !== 'message' || event.message.type !== 'text' || event.source.type !== 'group') {
    return false; // ไม่ใช่สแปม (เพราะไม่ใช่หน้าที่เราตรวจ)
  }

  const { userId, groupId } = event.source;

   // 🛑 เพิ่มจุดนี้: เช็คว่ากลุ่มนี้เปิดกันสแปมไหม?
   const config = await getGroupConfig(groupId);
   if (!config.features.spam) {
     return false; // ถ้าปิดกันสแปม ก็ปล่อยผ่านเลย
   }
   // ✨ 2. (เพิ่มใหม่) เช็คว่าเป็นแอดมินไหม? ถ้าใช่ ให้ปล่อยผ่าน (Immunity)
  // ให้ใส่ User ID ตัวจริงของคุณตรงคำว่า "USER_ID_ของคุณ"
  // หรือถ้าไม่อยาก Hardcode ตรงนี้ ให้ไปแก้ storage.js ให้ export MASTER_ID มาใช้
  const MY_MASTER_ID = "U42ccfb896a406bc44dea5f974b59fab6"; // ใส่ ID คุณตรงนี้
  
  const isAdmin = await isGroupAdmin(groupId, userId, MY_MASTER_ID);
    if (isAdmin) {
      return false; 
    }
  const now = Date.now();

  // ดึง State
  let state = userState.get(userId) || { timestamps: [], lastAlert: 0, lastActive: now, violationCount: 0 };
  state.lastActive = now;
  state.timestamps.push(now);
  if (state.timestamps.length > 20) state.timestamps = state.timestamps.slice(-20);

  let detectedType = null;
  let debugInfo = '';

  // 1. เช็คความเร็ว (Speed Gap)
  if (state.timestamps.length >= 2) {
    const gap = state.timestamps[state.timestamps.length - 1] - state.timestamps[state.timestamps.length - 2];
    if (gap < SETTINGS.MIN_SPEED_GAP_MS) {
      detectedType = 'MACRO_SPEED';
      debugInfo = `Gap: ${gap}ms`;
    }
  }

  // 2. เช็คปริมาณ (Rate Limit)
  if (!detectedType) {
    const recentMessages = state.timestamps.filter(t => now - t <= SETTINGS.TIME_WINDOW_MS);
    if (recentMessages.length > SETTINGS.RATE_LIMIT_THRESHOLD) {
      detectedType = 'SPAM_VOLUME';
      debugInfo = `${recentMessages.length} msgs/sec`;
    }
  }

  // 3. เช็คจังหวะ (Rhythm)
  if (!detectedType && state.timestamps.length >= SETTINGS.CONSISTENCY_CHECK_COUNT) {
    const stdDev = calculateTimingConsistency(state.timestamps.slice(-SETTINGS.CONSISTENCY_CHECK_COUNT));
    if (stdDev !== null && stdDev < SETTINGS.MAX_TIMING_DEVIATION_MS) {
      detectedType = 'BOT_RHYTHM';
      debugInfo = `SD: ${stdDev.toFixed(2)}ms`;
    }
  }

  userState.set(userId, state);

  // --- ถ้าเจอ Spam ---
  if (detectedType) {
    if (now - state.lastAlert < SETTINGS.COOLDOWN_MS) return true; // เตือนไปแล้ว ให้ถือว่าจัดการแล้ว

    state.lastAlert = now;
    state.violationCount++;
    userState.set(userId, state);

    try {
      const profile = await client.getGroupMemberProfile(groupId, userId);
      const name = profile.displayName;

      console.log(`🚨 DETECTED: ${name} | ${detectedType}`);

      let msg = '';
      // ถ้าผิดเกิน 3 ครั้ง ให้เรียก Admin
      if (state.violationCount >= 3) {
        msg = `🚨 แจ้งเตือน Admin! พบผู้ใช้: ${name}\nพฤติกรรม: ${detectedType}\n(ผิดครั้งที่ ${state.violationCount})`;
        // ที่นี่เปลี่ยนเป็น Flex Message ได้ตามโค้ดเก่า
      } else {
        msg = `⚠️ เตือนคุณ ${name}: กรุณาอย่าใช้โปรแกรมช่วยครับ (${debugInfo})`;
      }

      await client.replyMessage(event.replyToken, { type: 'text', text: msg });
      return true; // ส่งกลับไปบอก index.js ว่า "นี่คือสแปม ห้ามทำอย่างอื่นต่อ"

    } catch (e) {
      console.log('Error in spam guard:', e.message);
    }
    return true;
  }

  return false; // ปลอดภัย ไม่ใช่สแปม

}

// ========================================================
// 🔧 ส่วนเสริมสำหรับ Admin Command (เพิ่มใหม่)
// ========================================================

// 1. ฟังก์ชันดูสถานะระบบ
export function getSpamStats() {
  let totalViolations = 0;
  let activeUsers = 0;
  
  // นับจำนวนคนทำผิดรวม
  for (const [_, data] of userState.entries()) {
    if (data.violationCount > 0) totalViolations += data.violationCount;
    activeUsers++;
  }

  return {
    monitoredUsers: activeUsers,
    totalViolations: totalViolations
  };
}

// 2. ฟังก์ชันล้างโทษ (Reset)
export function resetSpamState(targetUserId = null) {
  if (targetUserId) {
    // ล้างเฉพาะคน (ถ้ามี ID)
    userState.delete(targetUserId);
    return `ล้างประวัติผู้ใช้ ${targetUserId} เรียบร้อย`;
  } else {
    // ล้างทั้งระบบ (Reset All)
    const count = userState.size;
    userState.clear();
    return `ล้างประวัติทั้งหมด (${count} users) เรียบร้อย`;
  }
}

// ระบบล้าง Memory (Garbage Collection)
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userState.entries()) {
    if (now - data.lastActive > SETTINGS.DATA_RETENTION_MS) userState.delete(userId);
  }
}, SETTINGS.MEMORY_CLEANUP_MS);