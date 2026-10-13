# FINAL MAJOR PROJECT PRESENTATION: SLIDE-BY-SLIDE CONTENT

Use this content directly inside your presentation template: **`Major FINAL temp.pptx`**.

---

### SLIDE 1: Title Slide
* **Project Title**: **Deceive to Defend: An Autonomous Agentic AI Honeypot for Proactive Scam Intelligence and Threat Extraction**
* **Department**: Department of Artificial Intelligence and Data Science
* **Institution**: Global Academy of Technology, Bengaluru, Karnataka
* **Project Batch / Team Members**:
  - **Naval C. N.** (1GA23AD034)
  - **Chaitanya A. M.** (1GA23AD011)
  - **Emmanuel Lara** (1GA23AD015)
* **Under the Guidance of**: **Dr. Ugranada Channabasava**, Associate Professor / Professor, Dept. of AI & DS, GAT

---

### SLIDE 2: Problem Statement *(Single Paragraph Format - As Requested)*
> Rapid digitization of Indian payment ecosystems like UPI has spurred an unprecedented surge in conversational cyber fraud across Telegram and WhatsApp, where scammers exploit panic and lucrative fake jobs to siphon money. Existing defenses operate purely passively by filtering or discarding suspicious messages, which protects a single user momentarily but imposes zero cost on the scammer while abandoning critical forensic intelligence such as destination UPI IDs, mule accounts, and phishing links. There is an urgent need for an active, autonomous deceptive defense system that can engage scammers in real time, waste their operational resources, extract actionable cyber threat intelligence, and automatically enforce perimeter blocking without requiring costly computing infrastructure or human intervention.

---

### SLIDE 3: Motivation & Research Gap
* **Asymmetric Cyber Economics**: Attackers automate mass scam blasts at near-zero marginal cost, while victims and cyber defense cells react only after irreversible financial loss.
* **Limitations of Existing Chatbots**:
  - High inference latency (>2–4s) and unsustainable token costs when using proprietary APIs like GPT-4.
  - Predictable, grammatically flawless responses that scammers easily flag as AI bots.
  - Inability to ingest multi-modal artifacts such as dynamic UPI payment QR codes.
* **Our Solution**: An autonomous honeypot running low-latency Groq LPU inference with culturally authentic personas, stochastic anti-fingerprinting delays, and NPCI-compliant QR code decoding at zero marginal API cost.

---

### SLIDE 4: Project Objectives
1. **Autonomous Scam Classification**: Automatically detect incoming social engineering vectors (KYC freeze, utility bill threats, job/task scams, crypto fraud) in real time.
2. **Adaptive Persona Stalling**: Implement a multi-turn state machine dynamically switching between cultural victim personas (*Kamla Devi*, *Rohan Sharma*, *Rajesh Uncle*) to sustain engagement.
3. **Anti-Fingerprinting Evasion**: Deploy a dual-stage Gaussian delay model (cognitive reading + keystroke speed) and phonetic typo injection to defeat attacker bot-detection heuristics.
4. **Multi-Modal IOC Extraction**: Autonomously decode UPI QR deep links (`upi://pay`), parse image OCR text, and cross-reference links with URLhaus abuse threat feeds.
5. **Real-Time SOC Console & Automated Firewall**: Provide visual telemetry for security analysts and enforce instant blacklisting on confirmed scammers.

---

### SLIDE 5: Overall System Architecture
*(Display the 5-Tier Architecture Flowchart from Section III)*
* **Tier 1: Ingestion & Safety Firewall**: Webhook ingestion via n8n from Telegram; Known-contact whitelist check; Automated block enforcement for known scammers; Per-chat concurrency serializer.
* **Tier 2: LangGraph Agent Engine**: Fast Groq LPU inference (`openai/gpt-oss-20b`, <350ms); 0–10 scam scoring; Smart Silent Mode (score $\le 2$ remains silent for neutral greetings).
* **Tier 3: Anti-Fingerprinting Engine**: Dynamic response latency timer $T_{\text{delay}} = T_{\text{think}} + T_{\text{type}} + \text{Jitter}$; Hinglish mobile typo generator.
* **Tier 4: Forensic Threat Harvester**: NPCI QR code URI parser; 2-Tier Indian UPI regex engine; URLhaus reputation and domain heuristic scorer.
* **Tier 5: Persistence & SOC Dashboard**: MongoDB Atlas database storing transcripts and IOC profiles; React SOC console with 1-click firewall controls.

---

### SLIDE 6: Dynamic Multi-Persona State Machine
* **Kamla Devi (65yo Retired Schoolteacher, Jaipur)**:
  - *Triggered On*: Electricity power cut threats, bank card suspension, KYC verification panic.
  - *Texting Style*: Broken Hinglish fragments (*"hai ram"*, *"arre beta"*), panicked compliance, slow mobile typing.
* **Rohan Sharma (21yo Broke Engineering Student, Delhi)**:
  - *Triggered On*: Work-from-home gigs, YouTube video like/rating tasks, quick money scams.
  - *Texting Style*: Fast college slang (*"bro"*, *"bhai"*, *"kitna milega?"*, *"done bhai"*), eager for pocket money.
* **Rajesh Uncle (52yo Textile Merchant, Surat)**:
  - *Triggered On*: High-yield crypto trading, forex arbitrage, insider stock tips.
  - *Texting Style*: Respectful Indian merchant tone (*"Namaste ji"*, *"sure profit hoga na?"*), cautious greed.
* **5-Stage Stalling Playbook**:
  1. *Hook & Panic* $\rightarrow$ 2. *Feign App/UI Errors* $\rightarrow$ 3. *Staged Payment Failure (forces backup accounts)* $\rightarrow$ 4. *PIN/OTP Confusion* $\rightarrow$ 5. *Controlled Disengagement*.

---

### SLIDE 7: Anti-Fingerprinting Latency & Typo Model
* **The Evasion Formula**:
  $$T_{\text{delay}} = T_{\text{think}}(L_{\text{in}}) + (L_{\text{out}} \cdot k_{\text{type}}) + W \cdot \tau_{\text{pause}} + \epsilon$$
* **Stage 1 (Cognitive Deliberation)**: Simulates reading comprehension based on inbound threat length ($L_{\text{in}}$) plus persona hesitation ($\tau_{\text{verify}} \approx 4.5\text{s}$ for Kamla Devi searching for glasses).
* **Stage 2 (Physical Typing Speed)**: Strictly proportional to reply character length ($L_{\text{out}}$) at $140\text{ ms/char}$ for Kamla Devi and $60\text{ ms/char}$ for Rohan Sharma, plus inter-word pauses ($180\text{ ms/word}$).
* **Stage 3 (Hesitation Jitter)**: Random pauses simulating app switching (opening PhonePe / checking SMS).
* **Typo Perturbation**: Injects natural smartphone errors (*pls*, *paymnt*, *accont*, *msg*) with probability $P = 0.22$.

---

### SLIDE 8: Multi-Modal Threat Extraction & Enrichment
* **NPCI Dynamic QR URI Decoding**:
  - Scammers send QR images instead of text to bypass spam filters.
  - The honeypot decodes binary payloads: `upi://pay?pa=scammer@bank&pn=Fraudster&am=5000&mc=0000`.
  - Automatically parses Virtual Payment Address (VPA), payee merchant name, and requested amount.
* **Threat Enrichment Pipeline**:
  - Ingests URLs and queries the open **URLhaus (Abuse.ch)** API.
  - Inspects suspicious Top-Level Domains (`.top`, `.xyz`, `.buzz`) and sub-domain entropy.

---

### SLIDE 9: Experimental Results & Benchmarking
* **Controlled Benchmark (12 Test Scenarios)**:
  - **Scam Detection Accuracy**: **100.00%** (Precision: 100%, Recall: 100%, F1: 1.00)
  - **Persona Routing Accuracy**: **100.00% (8/8)**
  - **False Positive Rate**: **0.00%** (Benign greetings reliably kept silent)
* **Anti-Fingerprinting Latency Profile ($N=50$ Turns)**:
  - Mean Latency ($\mu$): **$5,893\text{ ms}$** ($\sigma = \pm 1,125\text{ ms}$)
  - Range: $3,652\text{ ms} - 8,840\text{ ms}$ (Stochastic Gaussian distribution)
* **Architectural Latency & Cost**:
  - Groq LPU Inference: **$220 - 380\text{ ms}$**
  - Marginal API Operating Cost: **Rs. 0.000** (Free-tier open-weights execution)

---

### SLIDE 10: Live Real-World Deployment Data (Telegram & MongoDB Atlas)
* **Empirical Live Telemetry**:
  - Total Recorded Sessions: **6 Live Sessions**
  - Confirmed Scams Identified: **5 Sessions (83.3%)**
  - Average Sustained Turns: **4.2 turns / session**
  - Active Personas Triggered: Kamla Devi: 4, Rohan Sharma: 2
* **Harvested Ground-Truth Indicators of Compromise (IOCs)**:
  - **6 Fraudulent UPI IDs**: `9876543210@ybl`, `9760572839@ybl`, `powerdiscom.bill@sbi`, `viptasks.reward@icici`, `kyc.verification.desk@axisbank`, `emergency.settlement@paytm`
  - **5 Phishing URLs & Domains**: `http://amazon-orders-help.com/cancel`, `https://youtube-brand-booster.biz/client9`, UPI deep links
  - **4 Attacker Mobile Identifiers**: `9876543210`, `+919876543210`, `9760572839`, `+919760572839`
  - **Firewall Enforcement**: 5 Confirmed Attacker Profiles permanently blacklisted in database.

---

### SLIDE 11: Real-World Conversation Case Studies
* **Case Study 1 (Utility Power Disconnection Scam)**:
  - Scammer threatened transformer line disconnection for Rs 3,450.
  - Kamla Devi persona feigned app failure on `powerdiscom.bill@sbi`.
  - Scammer was forced to disclose backup emergency account: `electricity.emergency@hdfcbank`.
* **Case Study 2 (YouTube Task Scam)**:
  - Scammer promised Rs 3,000–5,000 daily; Rohan Sharma persona pretended to like videos.
  - Extracted recruiter Telegram handle `@HrPriyaOnline`, phishing portal, and corporate ICICI mule UPI `viptasks.reward@icici`.
* **Case Study 3 (Multi-Modal Dynamic QR Scam)**:
  - Decoded Axis Bank KYC freeze QR code and Paytm emergency settlement QR code directly from binary buffers.

---

### SLIDE 12: SOC Analyst Console & Live Demo
*(Include screenshot or live demonstration of the React SOC Console at `http://localhost:5173`)*
* **Key Features Displayed**:
  - Real-time Threat Card Feed with confidence ratings.
  - Live IOC Viewer (UPI tags, Bank Accounts, Domains, Phone numbers).
  - Multi-Turn Transcript Inspector showing persona badges (*Kamla Devi*, *Rohan Sharma*) and simulated typing delays.
  - 1-Click Interactive Firewall Control (Instant Block / Unblock).

---

### SLIDE 13: Conclusion & Future Scope
* **Conclusion**:
  - Successfully designed, implemented, and validated an autonomous agentic honeypot.
  - Shifted cyber fraud economics from passive victim loss to active adversary resource exhaustion.
  - Harvested real forensic IOCs with zero marginal API cost using Groq LPUs.
* **Future Work**:
  - Integration with Voice AI for automated telephony / IVR scam call defense.
  - Reinforcement Learning (RL) to dynamically maximize attacker stalling duration.
  - Automated reporting integration with the Indian National Cyber Crime Reporting Portal (NCRP / I4C).
