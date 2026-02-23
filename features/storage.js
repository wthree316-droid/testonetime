// features/storage.js (ฉบับ Cloud Run / Firestore)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ตรวจสอบว่ามี App เริ่มรันหรือยัง (กัน Error เวลาเรียกซ้ำ)
if (getApps().length === 0) {
  initializeApp({
    // บน Cloud Run มันจะรู้จัก Project ID เองอัตโนมัติ ไม่ต้องใส่ Key
    projectId: process.env.GOOGLE_CLOUD_PROJECT 
  });
}

const db = getFirestore();
const COLLECTION_NAME = 'line_group_configs';

// ค่าเริ่มต้น
const DEFAULT_TEXT = `ยินดีต้อนรับคุณ
{name}
##
💥 สวัสดีค่ะ 💥
ยินดีต้อนรับทุกคนเข้าบ้านของเรานะคะ

👉 เครดิตบ้านดูในอัลบั้มได้เลยนะคะ 💸

: : : ข้อควรรู้ก่อนตัดสินใจลงวง : : :

มีค้ำท้ายขั้นต่ำ 1 งวดทุกมือ ตามบาลานซ์

❤️‍🔥 ท้าวส่งยอด 20.00 น
❤️‍🔥 ลูกแชร์ส่งยอดไม่เกิน 18.00 น 

❌ ยกเลิกวงคือยึดเป็นมือท้าว อย่าลงวงเกินตัว ลงเท่าที่ไหว ไม่กระทบใครค่ะ
❌ ไม่รับคนมีประวัติโกงทุกชนิด ❌
( หากเช็คเจอหลังส่งยอดเข้ามาแล้ว ไม่มีการคืนยอดนะคะ ยึดทันที ไม่คุย )
❌ ขายมือผ่านท้าวเท่านั้น หัก20% ❌
❌ วงเปีย/วงบิท ท้าวชดแค่ต้น ไม่ชดดอก

🌻 เพิ่มเติมดูที่โน๊ตได้นร้าาา 🌻

💸 มีเงินด่วน - ผ่อนของ สำหรับคนเครดิตจ๊าบๆด้วยนะค้าบบบ 😜
______________________________

: : : การจองวง : : :

🔰 พิมพ์จองวงครั้งละ 2 มือ ตามด้วยอิโมจิ
🔰 สายกำไรวงต้นสูงๆต้องเว้นบ้างนะคะ
🔰 งดใช้บอท ไม่รับคนใช้บอท ❌
______________________________
##
🍔 ท้าวชื่อบีมนะคะ อายุ 31 ปี 
FB : Siraya Janayasuk
ไลน์สำรอง @🌞 บีม ไลน์สำรอง 😻 

🧁 เลขาชื่อมด @🐜Tunchanok_siam🐜  ติดต่อสอบถามได้เลยนะคะ
###
https://line.me/ti/p/lS72uICg2z`;

const DEFAULT_CONFIG = {
  admins: [],
  welcomeMsg: DEFAULT_TEXT,
  features: { welcome: true, spam: true }
};

// Cache ใน RAM (เพื่อลดการอ่าน DB ถี่เกินไป)
let cache = new Map();

// ฟังก์ชันโหลดข้อมูล (ใช้ Cache แทนการดึงตลอดเวลา)
export async function getGroupConfig(groupId) {
  if (cache.has(groupId)) return cache.get(groupId);

  const docRef = db.collection(COLLECTION_NAME).doc(groupId);
  const doc = await docRef.get();

  if (!doc.exists) {
    // ถ้าไม่มี ให้สร้างใหม่
    const newConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    await docRef.set(newConfig);
    cache.set(groupId, newConfig);
    return newConfig;
  } else {
    const data = doc.data();
    cache.set(groupId, data);
    return data;
  }
}

// ฟังก์ชันบันทึก
export async function updateGroupConfig(groupId, newConfig) {
  // อัปเดต Cache
  cache.set(groupId, newConfig);
  // อัปเดต Database จริง (ทำงานเบื้องหลัง)
  await db.collection(COLLECTION_NAME).doc(groupId).set(newConfig);
}

// เช็ค Admin
export async function isGroupAdmin(groupId, userId, masterAdminId) {
  if (userId === masterAdminId) return true;
  const config = await getGroupConfig(groupId); // ต้องรอ await เพราะดึง DB
  return config.admins.includes(userId);
}