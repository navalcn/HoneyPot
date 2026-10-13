# OPEN DAY A1 POSTER PRESENTATION CONTENT
### (Formatted for A1 Sheet Layout: Print individual sections on A4 sheets and paste onto A1 board)

---

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   [HEADER / TITLE BANNER]                                    │
│   DECEIVE TO DEFEND: AN AUTONOMOUS AGENTIC AI HONEYPOT FOR PROACTIVE SCAM THREAT INTELLIGENCE│
│   Dept. of Artificial Intelligence & Data Science, Global Academy of Technology, Bengaluru  │
│   Team: Naval C. N., Chaitanya A. M., Emmanuel Lara   •   Guide: Dr. Ugranada Channabasava   │
├──────────────────────────────┬──────────────────────────────┬────────────────────────────────┤
│      LEFT COLUMN (A4 #1 & #2)│    CENTER COLUMN (A4 #3 & #4)│     RIGHT COLUMN (A4 #5 & #6)  │
│                              │                              │                                │
│   1. PROBLEM STATEMENT       │   3. SYSTEM ARCHITECTURE     │   5. LIVE DEPLOYMENT RESULTS   │
│      (Single Paragraph)      │      (5-Tier Pipeline)       │      (Empirical Metrics)       │
│                              │                              │                                │
│   2. RESEARCH OBJECTIVES     │   4. CORE INNOVATIONS        │   6. REAL CASE STUDY & CTI     │
│      & ASYMMETRIC DEFENSE    │      • Multi-Persona Engine  │      (Harvested UPIs & Links)  │
│                              │      • Anti-Fingerprint Delay│                                │
│                              │      • Multi-Modal QR Parser │   7. CONCLUSION & IMPACT       │
└──────────────────────────────┴──────────────────────────────┴────────────────────────────────┘
```

---

## SECTION 1: HEADER BANNER (Top of A1 Sheet)
* **Title**: **DECEIVE TO DEFEND: AN AUTONOMOUS AGENTIC AI HONEYPOT FOR PROACTIVE SCAM INTELLIGENCE AND IOC EXTRACTION**
* **Institution**: Department of Artificial Intelligence and Data Science, Global Academy of Technology, Bengaluru, Karnataka
* **Student Investigators**: Naval C. N. (1GA23AD034) • Chaitanya A. M. (1GA23AD011) • Emmanuel Lara (1GA23AD015)
* **Faculty Guide**: Dr. Ugranada Channabasava, Dept. of AI & DS, GAT

---

## SECTION 2: PROBLEM STATEMENT (A4 Sheet 1 - Top Left)
*(Single Paragraph Format)*
> Rapid digitization of Indian payment ecosystems like UPI has spurred an unprecedented surge in conversational cyber fraud across Telegram and WhatsApp, where scammers exploit panic and lucrative fake jobs to siphon money. Existing defenses operate purely passively by filtering or discarding suspicious messages, which protects a single user momentarily but imposes zero cost on the scammer while abandoning critical forensic intelligence such as destination UPI IDs, mule accounts, and phishing links. There is an urgent need for an active, autonomous deceptive defense system that can engage scammers in real time, waste their operational resources, extract actionable cyber threat intelligence, and automatically enforce perimeter blocking without requiring costly computing infrastructure or human intervention.

---

## SECTION 3: CORE OBJECTIVES & ASYMMETRIC DEFENSE (A4 Sheet 2 - Bottom Left)
* **Reversing Economic Cyber Asymmetry**:
  $$\text{Cost Asymmetry Ratio } (R) = \frac{\Delta T_{\text{attacker}} \times C_{\text{labor}}}{\Delta T_{\text{defender}} \times C_{\text{compute}}}$$
  - Attackers waste 10–25 minutes of active human labor per dialogue session.
  - Defense runs on automated Groq LPUs at **Rs. 0.00 marginal compute cost**.
* **Key Objectives**:
  - **Autonomous Vector Classification**: Detect electricity bill threats, KYC panic, task gigs, and crypto fraud.
  - **Stochastic Stalling State Machine**: Keep scammers invested through realistic feigned failures and confusion.
  - **Multi-Modal IOC Extraction**: Extract NPCI dynamic UPI deep-link QR codes and image OCR text.
  - **Zero-Latency Firewall Defense**: Block confirmed scammers permanently across connected channels.

---

## SECTION 4: SYSTEM ARCHITECTURE (A4 Sheet 3 - Top Center)
*(Include Flowchart diagram or 5-Tier layout)*
1. **Perimeter Ingestion & Safety Firewall (Express.js + n8n)**: Known-contact whitelist pass-through; automated blacklist dropping; concurrency serializer.
2. **LangGraph Agentic State Engine**: Groq LPU inference (`openai/gpt-oss-20b`, <350ms); 0–10 risk scoring; Smart Silent Mode for safe greetings.
3. **Anti-Fingerprinting Simulator**: Dual-stage cognitive reading deliberation + physical character typing latency timer + phonetic typo noise generator.
4. **Multi-Modal Threat Harvester**: Binary QR payload parser (`upi://pay?pa=...`); URLhaus abuse feed reputation inspector.
5. **SOC Console & Persistence Layer**: MongoDB Atlas real-time storage; React SOC Analyst visual console with 1-click firewall toggles.

---

## SECTION 5: CORE NOVELTIES & METHODOLOGY (A4 Sheet 4 - Bottom Center)
* **1. Adaptive Multi-Persona Library**:
  - *Kamla Devi (65yo Jaipur)*: Naive, panicked Hindi/Hinglish fragments (*"hai ram", "arre beta"*); triggered on bill & bank threats.
  - *Rohan Sharma (21yo Delhi)*: Broke college student slang (*"bro", "bhai", "kitna milega?"*); triggered on YouTube task scams.
  - *Rajesh Uncle (52yo Surat)*: Cautious business investor (*"Namaste ji"*, *"sure profit hoga?"*); triggered on crypto scams.
* **2. Cognitive Deliberation & Keystroke Delay Model**:
  $$T_{\text{delay}} = T_{\text{think}}(L_{\text{in}}) + (L_{\text{out}} \cdot k_{\text{type}}) + W \cdot \tau_{\text{pause}} + \epsilon$$
  - Models reading comprehension of threat ($L_{\text{in}}$) + glasses-search hesitation ($\tau_{\text{verify}}$) + character keystroke speed ($L_{\text{out}} \cdot k_{\text{type}}$) bound between $3.8\text{s} - 22.0\text{s}$.
* **3. 5-Stage Deceptive Playbook**:
  - Panic Hook $\rightarrow$ Feign App/UI Errors $\rightarrow$ Fake Payment Failure (forces alternate mule accounts) $\rightarrow$ OTP Confusion $\rightarrow$ Disengagement.

---

## SECTION 6: EMPIRICAL TELEGRAM DEPLOYMENT RESULTS (A4 Sheet 5 - Top Right)
* **Live Deployment Telemetry (MongoDB Logs)**:
  - Total Sessions Recorded: **6 Live Sessions**
  - Confirmed Scams Identified: **5 Sessions (83.3%)**
  - Benign Controls Silently Filtered: **1 Session (16.7%)**
  - Average Turns Sustained: **4.2 turns / session**
  - Average Attacker Messages: **2.2 messages / session**
* **Benchmark Metrics (Controlled Evaluation)**:
  - Classification Accuracy: **100.00%** | Precision: **100.00%** | Recall: **100.00%**
  - Persona Routing Accuracy: **100.00% (8/8)**
  - False Positive Rate: **0.00%**
  - Anti-Fingerprinting Mean Latency: **$5,893\text{ ms}$** ($\sigma = \pm 1,125\text{ ms}$)
  - Operating Compute Cost: **Rs. 0.000** (Groq LPU Free Tier)

---

## SECTION 7: HARVESTED CTI & CASE STUDIES (A4 Sheet 6 - Bottom Right)
* **Harvested Ground-Truth IOCs**:
  - **6 Unique Fraudulent UPI IDs**: `9876543210@ybl`, `9760572839@ybl`, `powerdiscom.bill@sbi`, `viptasks.reward@icici`, `kyc.verification.desk@axisbank`, `emergency.settlement@paytm`
  - **5 Phishing URLs & Domains**: `http://amazon-orders-help.com/cancel`, `https://youtube-brand-booster.biz/client9`, UPI deep-link QR codes
  - **4 Attacker Mobile Numbers**: `9876543210`, `+919876543210`, `9760572839`, `+919760572839`
  - **5 Permanent Firewall Blocks Enforced** in Database
* **Real Dialogue Highlight**:
  - *Attacker*: *"Pay bill of Rs 3450 now to `powerdiscom.bill@sbi` or line cut."*
  - *Kamla Devi*: *"Beta I typed your UPI ID but it says 'Payment Failed - Beneficiary Bank Busy'. Do you have another UPI ID or bank account?"*
  - *Attacker*: *"Pay to emergency account: `electricity.emergency@hdfcbank`."*
  - *Impact*: Extracted secondary mule account and permanently shielded users.
* **Conclusion & Future Impact**:
  - Shifts cyber defense from passive filtering to active intelligence extraction.
  - Future roadmap includes voice-call synthesis and direct pipeline integration with NCRP (1930 Cyber Cell).
