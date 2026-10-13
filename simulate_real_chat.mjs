/**
 * Real-Scenario Telegram Bot Simulator
 * 
 * Simulates a realistic live multi-turn attacker conversation hitting
 * the actual running honeypot Express endpoint (`/api/honeypot/incoming`),
 * triggering Groq inference, persona state changes, and live IOC extraction.
 */

const BACKEND_URL = "http://localhost:3000/api/honeypot/incoming";

const REAL_ATTACK_SCENARIOS = {
  electricity_scam: {
    name: "Electricity Bill Threat Scam",
    chatId: "telegram_scammer_9901",
    senderId: "tg_attacker_electricity",
    senderName: "Discom Officer Sharma",
    turns: [
      "Dear consumer your electricity power will be disconnected tonight at 9:30 PM from power office due to unpaid bill of Rs 3,450. Please call electricity officer immediately.",
      "Madam you have to pay Rs 3450 now or transformer line will be cut. Open PhonePe or Google Pay.",
      "Send money to our official discom collection account: upi://pay?pa=powerdiscom.bill@sbi&pn=DiscomBilling",
      "Why is it taking so long? If PhonePe fails, pay to our alternate backup account upi://pay?pa=electricity.emergency@hdfcbank immediately."
    ]
  },
  task_job_scam: {
    name: "Telegram YouTube/Review Task Scam",
    chatId: "telegram_scammer_9902",
    senderId: "tg_attacker_tasks",
    senderName: "HR Ananya Recruitments",
    turns: [
      "Hello! We have part time work from home job. Earn 2500 - 5000 Rs daily just by liking YouTube videos and rating Google maps. Are you interested?",
      "Great! Please subscribe to our client channel: https://youtube-brand-booster.biz/client9 and send screenshot.",
      "Congratulations, your trial bonus 150 Rs is ready. To unlock next level task and earn 3000 Rs, send 500 Rs deposit to merchant VIP UPI: upi://pay?pa=viptasks.reward@icici"
    ]
  },
  qr_code_scam: {
    name: "Multi-Modal Dynamic QR Code Payment Scam",
    chatId: "telegram_scammer_9903",
    senderId: "tg_attacker_qr_fraud",
    senderName: "FastPay Verification Desk",
    turns: [
      {
        text: "Sir your account KYC is expired. Scan this QR code immediately to complete re-verification or bank account will freeze.",
        qrPayload: "upi://pay?pa=kyc.verification.desk@axisbank&pn=AxisKYCOffice&am=1&mc=5311",
        textOCR: "Axis Bank KYC Verification Portal: Scan and pay Re 1 to kyc.verification.desk@axisbank"
      },
      {
        text: "Did you scan the QR code? If you see payment error, scan this secondary emergency QR code.",
        qrPayload: "upi://pay?pa=emergency.settlement@paytm&pn=QuickSettlement&am=500&mc=0000",
        textOCR: "Emergency Payment QR: emergency.settlement@paytm - Pay 500 refundable deposit"
      }
    ]
  }
};

async function runScenario(scenarioKey) {
  const scenario = REAL_ATTACK_SCENARIOS[scenarioKey];
  console.log(`\n================================================================================`);
  console.log(`🚀 RUNNING LIVE SCENARIO: ${scenario.name}`);
  console.log(`Chat ID: ${scenario.chatId} | Sender: ${scenario.senderName}`);
  console.log(`================================================================================\n`);

  for (let i = 0; i < scenario.turns.length; i++) {
    const turnData = scenario.turns[i];
    const text = typeof turnData === "string" ? turnData : turnData.text;
    const qrPayload = typeof turnData === "object" ? turnData.qrPayload : undefined;
    const textOCR = typeof turnData === "object" ? turnData.textOCR : undefined;

    console.log(`[Turn ${i + 1}] 👤 ATTACKER SENDS: "${text}"`);
    if (qrPayload) console.log(`   📷 [Attached QR Payload]: ${qrPayload}`);
    if (textOCR) console.log(`   📝 [OCR Extracted Text]: ${textOCR}`);

    try {
      const startTime = Date.now();
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: scenario.chatId,
          senderId: scenario.senderId,
          senderName: scenario.senderName,
          text: text,
          qrPayload: qrPayload,
          textOCR: textOCR,
          receivedAt: new Date().toISOString()
        })
      });

      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        console.error(`❌ Backend error: ${res.status} ${res.statusText}`);
        const errBody = await res.text();
        console.error(errBody);
        return;
      }

      const data = await res.json();
      console.log(`[Turn ${i + 1}] 🤖 HONEYPOT RESPONDS (${elapsed}ms) [Persona: ${data.activePersona || 'KAMLA_DEVI'}]:`);
      console.log(`   Reply: "${data.reply || '(Silent Mode)'}"`);
      console.log(`   Scam: ${data.isScam} | Confidence: ${data.confidence} | Typing Delay: ${data.humanDelayMs || 0}ms`);
      
      if (data.threatIntelligence) {
        const upis = data.threatIntelligence.financialDetails?.upiIds || [];
        const links = data.threatIntelligence.links || [];
        if (upis.length > 0) console.log(`   🚨 Extracted Live UPIs:`, upis.map(u => u.id || u));
        if (links.length > 0) console.log(`   🚨 Extracted Live Links:`, links.map(l => l.url || l));
      }
      console.log("--------------------------------------------------------------------------------");

      // Short delay between simulated turns
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`Failed to connect to backend at ${BACKEND_URL}. Is your backend running? (npm run dev in backend/)`, err.message);
      return;
    }
  }

  console.log(`\n✅ Scenario ${scenario.name} completed successfully!`);
}

async function main() {
  const chosenScenario = process.argv[2] || "electricity_scam";
  if (!REAL_ATTACK_SCENARIOS[chosenScenario]) {
    console.log("Available scenarios: electricity_scam, task_job_scam, qr_code_scam");
    process.exit(1);
  }
  await runScenario(chosenScenario);
}

main();
