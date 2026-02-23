// features/groupManager.js
// --------------------------------------------------------
// 👋 ระบบต้อนรับสมาชิกใหม่ (Ultimate Custom + Link Action)
// --------------------------------------------------------
import { getGroupConfig } from './storage.js';

export async function handleGroupEvents(event, client) {
  const { groupId } = event.source;

  // --- กรณีมีคนเข้ากลุ่ม ---
  if (event.type === 'memberJoined') {
    const config = await getGroupConfig(groupId);

    if (!config.features.welcome) return true;

    for (const member of event.joined.members) {
      try {
        const profile = await client.getGroupMemberProfile(groupId, member.userId);
        const displayName = profile.displayName || "สมาชิกใหม่";
        
        // รูปโปรไฟล์
        const pictureUrl = profile.pictureUrl && profile.pictureUrl.startsWith('https')
          ? profile.pictureUrl 
          : "https://cdn-icons-png.flaticon.com/512/847/847969.png";

        // ====================================================
        // ✂️ Logic การตัดคำสั่ง (Header / Body / Footer / URI)
        // ====================================================
        const rawInput = config.welcomeMsg || "";
        
        // 1. แยก URI ออกมาก่อน (ใช้ ###)
        // ถ้ามี ### ให้เอาส่วนหลังเป็นลิงก์ ส่วนหน้าเป็นเนื้อหา
        const uriParts = rawInput.split("###");
        const contentPart = uriParts[0]; // เนื้อหาข้อความ
        let targetUri = uriParts.length > 1 ? uriParts[1].trim() : ""; // ลิงก์ (ถ้ามี)

        // ตรวจสอบความถูกต้องของลิงก์เบื้องต้น (ต้องขึ้นต้นด้วย http)
        // ถ้าใส่มามั่วๆ ไม่ใส่ action ให้ เพื่อกัน Error
        let actionObj = undefined;
        if (targetUri && (targetUri.startsWith("http://") || targetUri.startsWith("https://"))) {
            actionObj = {
                type: "uri",
                label: "ติดต่อเรา",
                uri: targetUri
            };
        } else if (targetUri && targetUri.startsWith("line://")) {
             // รองรับ line schema ด้วย
             actionObj = {
                type: "uri",
                label: "ติดต่อเรา",
                uri: targetUri
            };
        }

        // 2. แยกส่วนข้อความ (Header / Body / Footer) ด้วย ##
        const parts = contentPart.split("##").map(p => p.trim());

        // กำหนดค่าเริ่มต้น
        let headerTpl = "Hi, {name}";
        let bodyTpl = "ยินดีต้อนรับสู่กลุ่มครับ";
        let footerTpl = "โปรดปฏิบัติตามกฎกลุ่ม";

        // Logic การใส่ข้อมูลตามจำนวนท่อนที่แบ่งได้
        if (parts.length === 1 && parts[0]) {
            bodyTpl = parts[0];
        } else if (parts.length === 2) {
            bodyTpl = parts[0];
            footerTpl = parts[1];
        } else if (parts.length >= 3) {
            headerTpl = parts[0];
            bodyTpl = parts[1];
            footerTpl = parts[2];
        }

        // แทนที่ {name} ด้วยชื่อจริง
        const headerText = headerTpl.replace(/{name}/g, displayName);
        const bodyText = bodyTpl.replace(/{name}/g, displayName);
        const footerText = footerTpl.replace(/{name}/g, displayName);

        const flexMessage = {
          type: "flex",
          altText: `ยินดีต้อนรับคุณ ${displayName}`,
          contents: {
            type: "bubble",
            // ============================================
            // 1. ส่วนหัว (Header)
            // ============================================
            header: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#D39D55",
              paddingAll: "lg",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  alignItems: "center",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      width: "60px",
                      height: "60px",
                      cornerRadius: "30px",
                      borderColor: "#FFFFFF",
                      borderWidth: "2px",
                      contents: [
                        {
                          type: "image",
                          url: pictureUrl,
                          size: "full",
                          aspectMode: "cover"
                        }
                      ]
                    },
                    {
                      type: "text",
                      text: headerText,
                      color: "#FFFFFF",
                      weight: "bold",
                      size: "lg",
                      margin: "md",
                      wrap: true,
                      flex: 1
                    }
                  ]
                }
              ]
            },
            // ============================================
            // 2. ส่วนเนื้อหา (Body)
            // ============================================
            body: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FFFFFF",
              contents: [
                {
                  type: "text",
                  text: bodyText,
                  wrap: true,
                  color: "#333333",
                  size: "sm",
                  lineSpacing: "4px"
                }
              ]
            },
            // ============================================
            // 3. ส่วนท้าย (Footer)
            // ============================================
            footer: {
              type: "box",
              layout: "vertical",
              backgroundColor: "#cc0000", // สีแดง
              paddingAll: "md",
              contents: [
                {
                  type: "text",
                  text: footerText, // ข้อความ Footer
                  color: "#FFFFFF",
                  weight: "bold",
                  size: "sm",
                  align: "center",
                  wrap: true,
                  // ✨ ใส่ Action ตรงนี้ตามที่คุณต้องการ ✨
                  // ถ้ามี actionObj (คือมีลิงก์หลัง ###) ก็จะกดได้ ถ้าไม่มีก็เป็นข้อความธรรมดา
                  action: actionObj 
                }
              ]
            },
            styles: {
              footer: {
                separator: false
              }
            }
          }
        };

        await client.replyMessage(event.replyToken, flexMessage);

      } catch (e) {
        console.error("Flex Error:", e.message);
      }
    }
    return true;
  }

  if (event.type === 'memberLeft') {
    return true;
  }

  return false;
}