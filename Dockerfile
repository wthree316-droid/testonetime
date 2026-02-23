# ใช้ Node.js เวอร์ชันเบาๆ
FROM node:18-slim

# ตั้ง Folder งาน
WORKDIR /app

# ก๊อปปี้ไฟล์ package.json ไปก่อน (เพื่อ Cache layer)
COPY package*.json ./

# ลงโปรแกรม
RUN npm install --production

# ก๊อปปี้โค้ดทั้งหมดลงไป
COPY . .

# เปิด Port 8080 (Cloud Run บังคับ Port นี้)
ENV PORT=8080

# คำสั่งรัน
CMD ["node", "index.js"]