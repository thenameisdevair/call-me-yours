
---

# SDLC Phase 1 — Planning Document
## Call Me Yours (CMY)

---

## 1. Project Overview

**Project Name:** Call Me Yours
**Short Identifier:** CMY
**Platform:** MiniPay Mini App (Celo Blockchain)
**Document Stage:** Phase 1 — Planning
**Version:** 1.0

**Project Summary:**
Call Me Yours is a dating Mini App built exclusively for existing MiniPay users, discoverable through MiniPay's app discovery page. It leverages MiniPay's phone-verified wallet identity to eliminate fake profiles, uses micro-payment friction to eliminate spam and bots, and introduces a milestone-driven gifting economy where real sustained connection is rewarded through user-to-user cUSD gift transfers on Celo mainnet.

---

## 2. Problem Statement

Online dating in the Global South is broken in four specific ways:

**Fake profiles and catfishing** — Traditional dating apps have no real identity verification. Anyone can create multiple accounts with stolen photos and false information.

**Bots and spam** — Free interaction models mean zero cost to spam hundreds of users. Low-effort behavior dominates.

**No accountability** — Ghosting, harassment, and dishonest behavior carry no consequence. There is no reputation system.

**Expensive premium models** — Subscription-based monetization (Tinder Gold, Bumble Boost) is priced for Western markets. For the average Global South user these prices are a real barrier.

**CMY solves all four problems using infrastructure MiniPay already provides.**

---

## 3. Proposed Solution

A lightweight dating Mini App where:

- Identity is solved before the app opens — MiniPay phone number verification means one real person per wallet, no duplicates
- Spam is solved by micro-payment friction on connection requests — cost to initiate contact kills bots overnight
- Accountability is enforced through on-chain interaction history tied to a permanent wallet address
- Monetization is interaction-based not subscription-based — users pay only for meaningful actions
- Connection is rewarded through a milestone engine that tracks relationship progression and surfaces gifting opportunities at meaningful moments
- Gifts carry real cUSD value, sent directly user-to-user with zero platform cut

---

## 4. Project Scope

### In Scope for V1

- MiniPay Mini App (Next.js, runs inside MiniPay browser)
- Phone-wallet verified profile creation with photo upload
- Heterosexual matching only
- Browse and discover profiles
- Connection request with cUSD micro-payment
- Mutual match unlocks free chat
- Time and behavior-based milestone engine
- Fixed gift catalogue with platform-set prices
- User-to-user cUSD gift transfers on-chain
- Milestone notifications visible to both parties
- Gift fulfillment optional — visible to both, actioned by either
- Creator earnings dashboard — platform fee tracker
- Celo mainnet deployment
- MiniPay app discovery page submission

### Out of Scope for V1

- Open gift marketplace (creator-submitted gifts)
- Homosexual or non-binary matching
- Video or audio profiles
- In-app video or voice calls
- Subscription tiers
- Message content analysis or keyword detection
- AI-powered matchmaking algorithms
- Cross-chain support
- Native mobile app (iOS or Android standalone)
- Push notifications outside MiniPay
- In-app advertising

---

## 5. Goals

### Primary Goal
Build a culturally resonant, trust-first dating platform where phone-verified identity and micro-payment friction create a safer, more accountable dating environment, and where milestone-driven gifting deepens real connections through economically meaningful gestures.

### Secondary Goals
- Deliver a platform that works on low-data Android environments without performance compromise
- Establish a sustainable revenue model through connection request fees without subscription gates
- Create a gifting mechanic that feels culturally natural to Global South courtship behavior
- Build a foundation extensible to an open gift marketplace in V2

### Non-Goals
- CMY is not trying to compete with Tinder or Bumble globally in V1
- CMY is not trying to be a social media platform
- CMY is not trying to build a token economy

---

## 6. Target Users

### Primary User
Existing MiniPay wallet holders. Android users across the Global South — Nigeria, Kenya, Ghana, South Africa, and similar markets. Age range 18–35. Not necessarily crypto-native. Already comfortable with cUSD for daily transactions. Discovered CMY through MiniPay's app discovery page.

### User Characteristics
- Has an active MiniPay wallet with phone number verified
- Has some cUSD balance for interactions
- Uses Opera Mini or MiniPay standalone app
- On a low-to-mid range Android device
- On a variable data connection

---

## 7. Business Model

| Revenue Stream | Mechanism | Goes To |
|---|---|---|
| Connection request fee | Small fixed cUSD fee paid by user initiating contact | Platform |
| Gift catalogue margin | Platform sets gift prices above base cUSD value | Platform |
| Gift transfer value | Full cUSD value of gift purchased | Recipient user directly |

**What the platform never does:**
- Takes a cut of gift value sent between users
- Charges subscription fees
- Sells user data

---

## 8. Technical Constraints

| Constraint | Detail |
|---|---|
| Blockchain | Celo mainnet only — MiniPay does not support other chains |
| Transaction type | Legacy transactions only — MiniPay does not support EIP-1559 |
| Stablecoin | cUSD, USDC, USDT — V1 uses cUSD only |
| Wallet connection | Implicit via `window.ethereum.isMiniPay` — no connect button |
| App weight | Must be lightweight — MiniPay targets 2MB environments |
| Framework | Next.js — Celo Composer MiniPay template |
| Photo storage | Cannot store photos on-chain — requires off-chain storage solution |
| Message privacy | End-to-end encrypted — server never reads message content |
| Milestone detection | Client-side behavioral and time-based only — no content analysis |

---

## 9. Assumptions

- Every CMY user already has a MiniPay wallet with a verified phone number
- Users have a minimum cUSD balance sufficient to initiate at least one connection request
- MiniPay's app discovery page remains the primary distribution channel
- Celo mainnet fees remain sub-cent throughout V1 lifetime
- Profile photos will be stored off-chain with only the reference pointer stored on-chain or in the database

---

## 10. Dependencies

| Dependency | Purpose |
|---|---|
| MiniPay wallet | Identity verification, implicit wallet connection, cUSD transactions |
| Celo mainnet | On-chain transaction settlement for connection fees and gifts |
| cUSD stablecoin | Payment currency for all economic interactions |
| Off-chain storage (IPFS or cloud) | Profile photo hosting |
| Next.js + Celo Composer | Frontend framework and MiniPay template |
| viem / wagmi | Wallet interaction and transaction handling |
| Smart contract (Solidity) | Connection fee collection, gift transfer logic, milestone event recording |

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| Cold start problem — no users means no matches | High | High | Controlled launch within existing MiniPay user communities before public listing |
| Profile photo storage too heavy for MiniPay browser | Medium | High | Aggressive compression, lazy loading, CDN-backed off-chain storage |
| Milestone gaming — rapid fake interactions to trigger gifts | Medium | Medium | Rate limiting — milestones require activity spread across minimum distinct sessions |
| Gift mechanic ignored if milestone triggers feel arbitrary | Medium | Medium | Curate tight milestone library based on real courtship behavior patterns |
| Connection fee too high — kills user acquisition | Medium | High | Start conservatively at $0.05, adjust based on V1 user behavior data |
| Connection fee too low — insufficient spam prevention | Low | Medium | Monitor connection-to-match conversion rate post-launch |
| MiniPay app discovery rejection | Low | High | Strict adherence to MiniPay Mini App guidelines throughout development |
| cUSD balance barrier for new users | Medium | Medium | Surface clear onboarding instructions on how to fund MiniPay wallet |

---

## 12. Initial Project Timeline

| Phase | Estimated Duration | Output |
|---|---|---|
| Phase 1 — Planning | Week 1 | This document |
| Phase 2 — Requirements Analysis | Week 1–2 | Functional + non-functional requirements, user stories |
| Phase 3 — System Design | Week 2–3 | Architecture doc, smart contract design, UI wireframes |
| Phase 4 — Implementation | Week 3–7 | Smart contracts + frontend codebase |
| Phase 5 — Testing | Week 7–8 | Test report, bug fixes |
| Phase 6 — Deployment | Week 8–9 | Alfajores testnet → Celo mainnet → MiniPay submission |
| Phase 7 — Maintenance | Week 9+ | Iteration log, V2 planning |

---

## 13. Stakeholders

| Stakeholder | Role |
|---|---|
| Developer (You) | Builder, product owner, smart contract author |
| MiniPay / Celo Foundation | Platform distributor, app discovery gatekeeper |
| End Users | Dating app participants, gift senders and receivers |
| Celo Network | Transaction settlement infrastructure |

---

Phase 1 is now complete and properly detailed.

Ready to move into **Phase 2 — Requirements Analysis?**