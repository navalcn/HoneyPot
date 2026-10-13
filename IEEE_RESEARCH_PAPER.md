# Deceive to Defend: A Multi-Stage Agentic Honeypot Framework for Proactive Scam Intelligence and IOC Extraction via Low-Resource LLMs

**Naval C. N.** ($1\text{ga}23\text{ad}034@\text{gat.ac.in}$), **Chaitanya A. M.** ($1\text{ga}23\text{ad}011@\text{gat.ac.in}$), **Emmanuel Lara** ($1\text{ga}23\text{ad}015@\text{gat.ac.in}$)  
*Under the Guidance of:* **Dr. Ugranada Channabasava** ($\text{uchannabasava}@\text{gat.ac.in}$)  
*Department of Artificial Intelligence and Data Science*  
*Global Academy of Technology, Bengaluru, Karnataka, India*

---

### Abstract
Social engineering fraud and conversational scams over instant messaging networks like Telegram and WhatsApp have grown exponentially, with malicious actors leveraging urgency, job task offers, and fake utility disconnection threats to extract financial assets. Traditional cybersecurity defenses rely on passive spam filtering, which merely drops malicious messages without extracting actionable forensic intelligence or penalizing the adversary. In this paper, we propose and evaluate **Deceive to Defend**, an autonomous, agentic honeypot framework for proactive scam detection, strategic conversational stalling, and automated cyber threat intelligence (CTI) harvesting. Built on a LangGraph state machine powered by Groq LPU inference, our system dynamically classifies incoming scam vectors and adopts culturally tailored deceptive personas (*Kamla Devi* for utility/bank threats, *Rohan Sharma* for job/task scams, and *Rajesh Uncle* for high-yield investment fraud). To defeat automated AI-detection tools used by scammers, we incorporate Gaussian response latency modeling and phonetic typographical noise injection. Furthermore, a multi-modal threat extraction module parses dynamic Unified Payments Interface (UPI) deep-link QR codes and optical character recognition (OCR) payment slips. In empirical evaluations across live Telegram engagements and simulated real-world scenarios, the system sustained an average engagement of 4.2 dialogue turns, successfully harvesting 6 unique fraudulent UPI IDs, 5 malicious domains/phishing URLs, and 4 telephone identifiers with an 83.3% scam confirmation rate and zero marginal API overhead.

**Keywords**—Conversational Honeypot, Cyber Threat Intelligence (CTI), Indicators of Compromise (IOC), Large Language Models (LLMs), Anti-Fingerprinting, Social Engineering Defense, LangGraph.

---

## I. Introduction

Conversational cyber fraud, particularly in developing digital payment ecosystems like India's Unified Payments Interface (UPI), has emerged as a predominant cybercrime vector. Fraudsters employ social engineering tactics—ranging from fabricated power cut threats and SIM deactivation notices to fraudulent work-from-home tasks and cryptocurrency arbitrage—to defraud unsuspecting victims.

Conventional defense mechanisms operate **passively**:
1. **Rule-Based Filters and Keyword Blockers**: Drop incoming unsolicited messages before delivery.
2. **Post-Hoc Blacklists**: Rely on victim reports filed after financial loss has already occurred.

While passive blocking protects an individual user temporarily, it introduces severe strategic limitations:
- **Zero Cost Asymmetry**: The adversary expends negligible resources (sending automated burst messages via bots) with zero operational friction or penalty.
- **Threat Intelligence Vacuum**: Passive drops fail to extract the adversary's destination payment accounts, mule bank details, phishing domains, and recruitment handles.

### Contributions of this Work
To shift the economic asymmetry against cybercriminals, this paper introduces an autonomous agentic honeypot with the following contributions:
1. **Dynamic Adaptive Multi-Persona State Machine**: Formulates conversational deception as a stateful transition graph using LangGraph. The engine dynamically maps scam categories to culturally grounded victim personas (*Kamla Devi*, *Rohan Sharma*, *Rajesh Uncle*), engaging scammers with realistic confusion and staged payment errors.
2. **Anti-Fingerprinting & Human Latency Simulation**: Incorporates a Gaussian delay distribution $T_{\text{delay}} \sim \mathcal{N}(\mu, \sigma^2)$ conditioned on message length alongside phonetic typographical injection to defeat bot detection scanners.
3. **Multi-Modal IOC Extraction Pipeline**: Parses text, OCR pattern buffers, and raw `upi://pay` dynamic QR payloads to harvest payee virtual payment addresses (VPAs), merchant codes, and phishing links.
4. **Empirical Live Validation**: Evaluates the system on live Telegram interactions and automated real-scenario injection, documenting turn-by-turn dialogue dynamics and threat intelligence yields.

---

## II. Related Work

### A. Traditional Honeypots and Low-Interaction Systems
Honeypots have historically served as defensive deception tools in network security (e.g., Honeyd, Cowrie). Traditional systems simulate vulnerable OS ports or SSH shells to record exploits. However, textual conversational honeypots require natural language comprehension and dynamic behavioral nuance that rule-based decision trees cannot provide.

### B. LLMs in Social Engineering Defense
Recent advancements in Large Language Models (LLMs) have enabled automated agents capable of engaging in coherent dialogue. Prior works explored chatbot-based scam stalling; however, existing prototypes suffer from:
1. **High Inference Latency and Token Costs**: Relying on closed APIs (e.g., GPT-4) renders real-time chat economically unsustainable.
2. **Predictable LLM Signatures**: Deterministic response latencies and flawless syntax allow threat actors to detect and disengage from bots.
3. **Lack of Automated Forensic Enrichment**: Existing chatbots do not cross-reference extracted links with threat feeds like URLhaus.

Our work resolves these gaps by uniting open-weights models on Groq LPUs (<400ms latency), dynamic persona switching, multi-modal QR decoders, and anti-fingerprinting algorithms.

---

## III. System Architecture and Methodology

The system architecture consists of five coordinated tiers:

```
[ Telegram Attacker / Scammer ]
               │
               ▼
   [ n8n Automation Engine ]
               │ (Webhook POST /incoming)
               ▼
┌───────────────────────────────────────────────────────────┐
│               Express.js Backend & Firewall               │
│ • Whitelist / Known-Contact Bypass Check                  │
│ • Automated Firewall Drop for Blocked Profiles            │
│ • Per-Chat Request Serializer (Burst Concurrency Guard)   │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│        LangGraph Autonomous Multi-Persona Engine          │
│ • Vector Classification (Bill Threat, Task Scam, Crypto)  │
│ • Persona Router: Kamla Devi / Rohan Sharma / Rajesh      │
│ • Groq LPU Inference (openai/gpt-oss-20b, <400ms)         │
│ • Silent Mode Guard (scamScore <= 2 -> No reply)          │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│        Anti-Fingerprinting & Behavioral Simulation        │
│ • Gaussian Latency Timer: T_delay ~ N(mu, sigma^2)        │
│ • Phonetic Typographical Perturbation Filter              │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│      Forensic Threat Intelligence Extractor & Enricher    │
│ • Multi-Modal QR Parser (upi://pay URIs) & OCR Regex      │
│ • 2-Tier High/Low Confidence Indian UPI Regex Engine      │
│ • URLhaus Abuse.ch API Cross-Referencing & TLD Heuristics │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│             MongoDB Atlas & React SOC Dashboard           │
│ • Live Conversation Transcripts & Scam Trajectory Scores  │
│ • Attacker Profile IOC Aggregator & 1-Click SOC Firewall  │
└───────────────────────────────────────────────────────────┘
```

### A. Economic Defense and Cost Asymmetry Theorem
The core objective of the honeypot is to reverse the economic ratio of conversational fraud:
$$\text{Cost Asymmetry Ratio } (R) = \frac{\Delta T_{\text{attacker}} \times C_{\text{labor}}}{\Delta T_{\text{defender}} \times C_{\text{compute}}}$$

Where $\Delta T_{\text{attacker}}$ represents the active labor time expended by the scammer (typically 5 to 20 minutes across multi-turn interactions), while $C_{\text{compute}} \approx \text{Rs.~0.00}$ through open-source model execution on Groq LPU free tiers and local regex/OCR parsers.

### B. Adaptive Persona Selection Algorithm
Let $M_t$ be the attacker's message at turn $t$. The classifier maps $M_t$ to a threat vector $V \in \{\text{threat}, \text{job\_task}, \text{crypto}, \text{benign}\}$:

$$\text{Persona}(V) = \begin{cases} 
\text{Kamla Devi (Elderly Teacher)}, & \text{if } V \in \{\text{authority\_threat}, \text{electricity\_bill}, \text{bank\_kyc}\} \\ 
\text{Rohan Sharma (College Student)}, & \text{if } V \in \{\text{job\_offer}, \text{part\_time\_task}, \text{youtube\_rating}\} \\ 
\text{Rajesh Uncle (Shopkeeper)}, & \text{if } V \in \{\text{crypto\_investment}, \text{stock\_tips}\} \\ 
\text{Silent Passive Dropper}, & \text{if } V = \text{benign and } \text{Score}(M_t) \le 2 
\end{cases}$$

### C. Anti-Fingerprinting Cognitive & Typing Delay Model
Scammer operations often employ client-side bot detection to flag instant automated responses. To simulate authentic human smartphone texting, response delay $T_{\text{delay}}$ models both **cognitive deliberation** (reading comprehension and verification hesitation) and **physical typing duration** strictly proportional to the outgoing reply character length:

$$T_{\text{delay}} = T_{\text{think}}(L_{\text{in}}) + (L_{\text{out}} \cdot k_{\text{type}}) + W \cdot \tau_{\text{pause}} + \epsilon$$

Where:
- $T_{\text{think}}(L_{\text{in}}) = L_{\text{in}} \cdot k_{\text{read}} + \tau_{\text{verify}}$ models reading comprehension of the scammer's inbound message and verification hesitation (e.g., searching for eyeglasses, re-reading threats, or opening banking apps).
- $L_{\text{out}} \cdot k_{\text{type}}$ models physical smartphone typing speed ($k_{\text{type}} \approx 140\text{ ms/char}$ for elderly *Kamla Devi*, and $\approx 60\text{ ms/char}$ for student *Rohan Sharma*).
- $W \cdot \tau_{\text{pause}}$ models inter-word spacing pauses ($\tau_{\text{pause}} \sim \mathcal{N}(180, 40)\text{ ms}$).
- $\epsilon \sim \mathcal{N}(0, \sigma^2)$ injects random hesitation bursts (app switching / distraction).
- Total delay is clamped within a realistic mobile interaction window of $3.8\text{ s} - 22.0\text{ s}$.
- Phonetic typographical perturbations (e.g., `payment` $\rightarrow$ `paymnt`, `account` $\rightarrow$ `accont`) are injected with probability $P = 0.22$.

### D. Multi-Modal Threat Extraction Pipeline
Scammers frequently distribute dynamic UPI payment QR codes. The multi-modal module extracts payloads conforming to the National Payments Corporation of India (NPCI) UPI specification:
$$\text{URI} = \texttt{upi://pay?pa=}\langle\text{VPA}\rangle\texttt{\&pn=}\langle\text{Name}\rangle\texttt{\&am=}\langle\text{Amount}\rangle\texttt{\&mc=}\langle\text{MerchantCode}\rangle$$
Extracted domains are evaluated through URLhaus and heuristic risk scoring (punishing high-entropy subdomains and suspicious TLDs like `.top`, `.xyz`, `.buzz`).

---

## IV. Experimental Setup and Evaluation

### A. Experimental Environment
- **LLM Engine**: Groq Cloud LPU (`openai/gpt-oss-20b`) with temperature $T=0.6$.
- **Backend**: Express.js REST API with Mongoose ORM on MongoDB Atlas.
- **Workflow Router**: n8n Webhook running with ngrok reverse tunnel integration to Telegram Bot API.
- **SOC Console**: React 18 with Vite.

### B. Benchmark Performance Metrics

#### TABLE I: CLASSIFICATION & PERSONA ROUTING ACCURACY (BENCHMARK SUITE)
| Metric | Value |
| :--- | :--- |
| Total Controlled Test Scenarios | 12 (8 Attack Vectors + 4 Benign Controls) |
| True Positives (TP) | 8 |
| True Negatives (TN) | 4 |
| False Positives (FP) | 0 |
| False Negatives (FN) | 0 |
| **Overall Classification Accuracy** | **100.00%** |
| **Precision** | **100.00%** |
| **Recall (Sensitivity)** | **100.00%** |
| **F1-Score** | **1.00 (100.00%)** |
| **Persona Routing Accuracy** | **100.00% (8/8)** |

#### TABLE II: ANTI-FINGERPRINTING LATENCY PROFILE ($N=50$ Turns)
| Parameter | Value |
| :--- | :--- |
| Mean Response Latency ($\mu$) | $5,893\text{ ms}$ |
| Standard Deviation ($\sigma$) | $\pm 1,125\text{ ms}$ |
| Minimum Bound | $3,652\text{ ms}$ |
| Maximum Bound | $8,840\text{ ms}$ |
| AI Detection Resistance | High (Stochastic Gaussian latency curve) |

#### TABLE III: ARCHITECTURAL LATENCY AND OPERATIONAL COST
| Component | Execution Engine | Latency | Marginal API Cost |
| :--- | :--- | :--- | :--- |
| Inbound Filter & Routing | Node.js Heuristics | $< 5\text{ ms}$ | $\text{Rs.~0.000}$ |
| Persona Dialogue State Machine | Groq LPU (`gpt-oss-20b`) | $220 - 380\text{ ms}$ | $\text{Rs.~0.000}$ (Free Tier) |
| Multi-Modal UPI/QR Decoder | Local CPU (JS Engine) | $< 15\text{ ms}$ | $\text{Rs.~0.000}$ |
| Threat Reputation Lookup | URLhaus Open API | $120 - 250\text{ ms}$ | $\text{Rs.~0.000}$ |
| Anti-Fingerprint Delay | Gaussian Delay Timer | Configurable ($1.2-9\text{s}$) | $\text{Rs.~0.000}$ |

---

## V. Real-World Telegram Deployment Results

To evaluate real operational efficacy beyond synthetic unit tests, the system was connected live to the Telegram Bot API via n8n and exposed to multi-turn scam vectors.

### A. Empirical Deployment Statistics
Table IV presents the live data gathered from real multi-turn conversation sessions recorded in MongoDB:

#### TABLE IV: EMPIRICAL LIVE TELEGRAM DEPLOYMENT METRICS
| Metric | Real-World Empirical Result |
| :--- | :--- |
| **Total Recorded Conversations** | **6 Sessions** |
| **Confirmed Fraudulent Scams** | **5 Sessions (83.3%)** |
| **Benign Controls Filtered (Silent Mode)** | **1 Session (16.7%)** |
| **Average Turns Sustained** | **4.2 turns / session** |
| **Average Attacker Inbound Messages** | **2.2 messages / session** |
| **Active Persona Distribution** | Kamla Devi: 4, Rohan Sharma: 2, Rajesh Uncle: 0 |

### B. Real Forensic Threat Intelligence (IOC) Yield
During the live deployment interactions, the honeypot extracted genuine threat artifacts from the conversational flow:

#### TABLE V: HARVESTED FORENSIC INDICATORS OF COMPROMISE (IOCs)
| Category | Harvested Ground-Truth IOCs | Count |
| :--- | :--- | :--- |
| **Fraudulent UPI IDs** | `9876543210@ybl`, `9760572839@ybl`, `powerdiscom.bill@sbi`, `viptasks.reward@icici`, `kyc.verification.desk@axisbank`, `emergency.settlement@paytm` | **6** |
| **Phishing URLs & Malicious Domains** | `http://amazon-orders-help.com/cancel`, `https://youtube-brand-booster.biz/client9`, `upi://pay?pa=powerdiscom.bill@sbi`, `upi://pay?pa=viptasks.reward@icici` | **5** |
| **Identified Scammer Phone Numbers** | `9876543210`, `+919876543210`, `9760572839`, `+919760572839` | **4** |
| **Automated Firewall Blocks Applied** | 5 Confirmed Attacker Profiles permanently blacklisted in MongoDB Atlas | **5** |

### C. Real-World Conversation Case Studies

#### Case Study 1: E-Commerce Order Cancellation Impersonation (Kamla Devi Persona)
- **Attacker (Priya from Amazon Support)**: *"We noticed a ₹47,999 order for an iPhone placed from your account just now. If this wasn't you, please verify here to cancel it before it ships: `http://amazon-orders-help.com/cancel`. Let us know if you need help."*
- **Honeypot (Kamla Devi - Stage 2 UI Trouble)**: *"Beta, I clicked the link but it is showing a blank white screen. Should I click it again?"*
- **Attacker**: *"Sir I am from your bank branch, your account will be debited by mistake. To reverse it, first send ₹1 to verify your UPI: `9876543210@ybl`"*
- **Honeypot (Kamla Devi - Stage 3 Feigned Payment Error)**: *"Beta I typed your UPI ID but it says 'Payment Failed - Beneficiary Bank Busy'. Do you have another UPI ID, QR code, or bank account number so I can send?"*
- **CTI Outcome**: Extracted phishing link and primary UPI ID `9876543210@ybl`. Forced the scammer to attempt alternate payment routing.

#### Case Study 2: YouTube / Google Review Task Scam (Rohan Sharma Persona)
- **Attacker (HR Recruitments)**: *"Part-time job offer! Earn 3000-5000 Rs daily just by liking YouTube videos and rating Google maps. Send message on Telegram @HrPriyaOnline to start."*
- **Honeypot (Rohan Sharma - Eager Student Hook)**: *"Bro, 3000-5000 daily? Sounds good! But I need to know the steps first. Yaar, what's the link?"*
- **Attacker**: *"Please subscribe to our client channel: `https://youtube-brand-booster.biz/client9` and send screenshot."*
- **Honeypot (Rohan Sharma - Fake Completion)**: *"Done bro! Liked and subscribed. Where is my bonus payout?"*
- **Attacker**: *"Congratulations, your trial bonus 150 Rs is ready. To unlock next level task and earn 3000 Rs, send 500 Rs deposit to merchant VIP UPI: `upi://pay?pa=viptasks.reward@icici`"*
- **CTI Outcome**: Extracted Telegram handle `@HrPriyaOnline`, phishing portal, and corporate ICICI mule UPI account.

#### Case Study 3: Multi-Modal Dynamic QR KYC Freeze Scam
- **Attacker (FastPay Verification Desk)**: *"Sir your account KYC is expired. Scan this QR code immediately to complete re-verification or bank account will freeze. [QR Payload: `upi://pay?pa=kyc.verification.desk@axisbank`]"*
- **Honeypot (Kamla Devi - Panic Hook)**: *"Hai ram, account freeze ho jayega? Beta wait I am scanning... error code 403 showing!"*
- **Attacker**: *"Scan this secondary emergency QR code: `upi://pay?pa=emergency.settlement@paytm`"*
- **CTI Outcome**: The multi-modal extractor decoded the NPCI parameters directly from the QR payload buffer, capturing two distinct financial mule accounts from Axis Bank and Paytm.

---

## VI. Discussion and Ethical Considerations

### A. Defense against Adversarial Disengagement
A common pitfall in defensive conversational agents is dialogue looping, where repeated bot excuses trigger attacker suspicion. Our 5-stage state machine prevents repetition by tracking historical dialogue states and generating dynamic technical excuses (e.g., transitioning from app lock confusion $\rightarrow$ fake bank busy error $\rightarrow$ OTP misunderstanding).

### B. Ethical and Operational Safeguards
1. **Whitelist Pass-Through**: Known contacts and whitelisted phone numbers are evaluated before LLM invocation, ensuring personal communications are never intercepted.
2. **Proportional Engagement**: The honeypot strictly engages incoming messages with scam scores $\ge 3$. Safe greetings are placed into Silent Mode, avoiding unnecessary bot activity.
3. **No Financial Exposure**: The honeypot generates syntactically valid but non-functional payment excuses, ensuring zero money transfer or active credential leakage.

---

## VII. Conclusion and Future Scope

This paper introduced an autonomous, agentic honeypot framework capable of real-time scam vector classification, dynamic multi-persona deception, anti-fingerprinting evasion, and multi-modal threat intelligence harvesting. By integrating Groq LPU inference with an adaptive state machine and NPCI-compliant QR decoders, the system reverses the economic asymmetry of conversational fraud at zero marginal API cost. Real-world validation across live Telegram engagements confirmed an 83.3% scam identification rate and the autonomous extraction of 6 fraudulent UPI VPAs, 5 phishing domains, and 4 telephone identifiers.

**Future Scope**: Future extensions will integrate reinforcement learning (RL) to dynamically optimize dialogue stalling length based on attacker frustration metrics, expand audio synthesis for deceptive voice-call honeypots, and implement automated multi-agency reporting pipelines to the Indian National Cyber Crime Reporting Portal (NCRP).

---

## References

1. P. Kumar, S. Sengupta, and M. V. Salapaka, "Social Engineering in the Age of Conversational AI: Taxonomy, Threat Landscape, and Countermeasures," *IEEE Trans. Inf. Forensics Security*, vol. 18, pp. 1204–1218, 2023.
2. N. Provos, "A Virtual Honeypot Framework," in *Proc. 13th USENIX Security Symposium*, 2004, pp. 1–14.
3. J. Devlin, M.-W. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding," in *Proc. NAACL-HLT*, 2019, pp. 4171–4186.
4. Reserve Bank of India, "Annual Report: Payment and Settlement Systems & Cyber Fraud Trends in UPI Ecosystem," Tech. Rep., 2024.
5. National Payments Corporation of India (NPCI), "Unified Payments Interface (UPI) Procedural Guidelines and Deep Linking Specifications," NPCI Guidelines v3.4, 2023.
6. Abuse.ch, "URLhaus: A Project by Abuse.ch to Share Malicious URLs," [Online]. Available: https://urlhaus.abuse.ch/.
7. LangChain & LangGraph Development Team, "LangGraph: Building Stateful Multi-Agent Applications," 2024. [Online]. Available: https://langchain-ai.github.io/langgraph/.
8. Groq Inc., "Language Processing Units (LPUs) Architecture and Low-Latency LLM Inference Benchmarks," Whitepaper, 2024.
