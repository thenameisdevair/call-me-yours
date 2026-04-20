# CMY Phase 1 — Planning Document

## 1. Project Overview

**Project Name:** Call Me Yours
**Short Identifier:** CMY
**Platform:** MiniPay Mini App (Celo Blockchain)
**Version:** 1.0

**Project Summary:**
Call Me Yours is a dating Mini App built exclusively for existing MiniPay users,
discoverable through MiniPay's app discovery page. It leverages MiniPay's
phone-verified wallet identity to eliminate fake profiles, uses micro-payment
friction to eliminate spam and bots, and introduces a milestone-driven gifting
economy where real sustained connection is rewarded through user-to-user USDm
gift transfers on Celo mainnet.

---

## 2. Problem Statement

Online dating in the Global South is broken in four specific ways:

**Fake profiles and catfishing** — Traditional dating apps have no real identity
verification. Anyone can create multiple accounts with stolen photos and false
information.

**Bots and spam** — Free interaction models mean zero cost to spam hundreds of
users. Low-effort behavior dominates.

**No accountability** — Ghosting, harassment, and dishonest behavior carry no
consequence. There is no reputation system.

**Expensive premium models** — Subscription-based monetization is priced for
Western markets. For the average Global South user these prices are a real
barrier.

CMY solves all four problems using infrastructure MiniPay already provides.

---

## 3. Proposed Solution

- Identity solved before the app opens — MiniPay phone verification means one
  real person per wallet, no duplicates
- Spam solved by micro-payment friction on connection requests
- Accountability enforced through on-chain interaction history
- Monetization is interaction-based, not subscription-based
- Connection rewarded through milestone engine tracking relationship progression
- Gifts carry real USDm value, sent directly user-to-user with zero platform cut

---

## 4. Project Scope

### In Scope for V1
- MiniPay Mini App (Next.js)
- Phone-wallet verified profile creation with photo upload
- Heterosexual matching only
- Browse and discover profiles
- Connection request with USDm micro-payment
- Mutual match unlocks free chat
- Time and behavior-based milestone engine
- Fixed gift catalogue with platform-set prices
- User-to-user USDm gift transfers on-chain
- Milestone notifications visible to both parties
- Gift fulfillment optional — visible to both, actioned by either
- Celo mainnet deployment
- MiniPay app discovery page submission

### Out of Scope for V1
- Open gift marketplace
- Homosexual or non-binary matching
- Video or audio profiles
- In-app video or voice calls
- Subscription tiers
- Message content analysis
- AI-powered matchmaking
- Cross-chain support
- Native mobile app
- Push notifications outside MiniPay
- In-app advertising

---

## 5. Goals

**Primary Goal:**
Build a culturally resonant, trust-first dating platform where phone-verified
identity and micro-payment friction create a safer, more accountable dating
environment, and where milestone-driven gifting deepens real connections through
economically meaningful gestures.

**Secondary Goals:**
- Deliver a platform that works on low-data Android environments
- Establish sustainable revenue through connection request fees
- Create gifting mechanic that feels natural to Global South courtship behavior
- Build a foundation extensible to an open gift marketplace in V2

**V1 Success Metrics:**
- User can create a profile with photo inside MiniPay
- Matching flow works end to end
- At least one successful USDm connection request on-chain
- At least one milestone triggered and gift successfully sent
- Recipient wallet receives full gift USDm value
- App loads cleanly through MiniPay app discovery page

---

## 6. Target Users

**Primary User:**
Existing MiniPay wallet holders. Android users across the Global South —
Nigeria, Kenya, Ghana, South Africa. Ages 18-35. Not necessarily crypto-native.
Already comfortable with USDm for daily transactions. Discovered CMY through
MiniPay's app discovery page.

---

## 7. Business Model

| Revenue Stream | Mechanism | Goes To |
|---|---|---|
| Connection request fee | Fixed USDm fee paid by initiating user | Platform |
| Gift catalogue margin | Platform sets gift prices above base USDm value | Platform |
| Gift transfer value | Full USDm value of gift purchased | Recipient directly |

The platform never takes a cut of gift value sent between users.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cold start — no users means no matches | High | High | Controlled launch within MiniPay communities |
| Profile photo storage too heavy | Medium | High | Aggressive compression, lazy loading, CDN |
| Milestone gaming — rapid fake interactions | Medium | Medium | Rate limiting — activity spread across distinct sessions |
| Gift mechanic ignored | Medium | Medium | Tight milestone curation |
| Connection fee too high — kills acquisition | Medium | High | Start at $0.05, adjust post-launch |
| MiniPay app discovery rejection | Low | High | Strict adherence to MiniPay guidelines |
| cUSD balance barrier for new users | Medium | Medium | Deep-link to add cash screen |

---

## 9. Initial Project Timeline

| Phase | Duration | Output |
|---|---|---|
| 1. Planning | Week 1 | This document |
| 2. Requirements Analysis | Week 1-2 | Requirements doc |
| 3. System Design | Week 2-3 | Architecture doc |
| 4. Implementation | Week 3-7 | Codebase |
| 5. Testing | Week 7-8 | Test report |
| 6. Deployment | Week 8-9 | Live Mini App |
| 7. Maintenance | Week 9+ | Iteration log |
