# SDLC Phase 2 — Requirements Analysis
## Call Me Yours (CMY)

---

## 1. Introduction

This document translates the planning decisions from Phase 1 into a structured, detailed set of requirements that the development team will implement against. Every feature built in Phase 4 must trace back to a requirement defined here.

---

## 2. Stakeholder Requirements

Before functional requirements, we capture what each stakeholder needs the system to deliver.

| Stakeholder | Core Need |
|---|---|
| End User (Seeker) | Find real, verified matches without fake profiles or spam |
| End User (Gifter) | Express genuine interest through meaningful economic gestures |
| End User (Recipient) | Receive gifts at full value, feel safe and respected on platform |
| Platform (CMY) | Generate sustainable revenue through connection fees |
| MiniPay / Celo | Mini App that performs well, follows platform guidelines, drives cUSD usage |

---

## 3. Functional Requirements

Functional requirements define exactly what the system must do. Each is assigned a unique ID for traceability.

---

### 3.1 Authentication and Identity

| ID | Requirement |
|---|---|
| FR-01 | The system must detect when it is loaded inside MiniPay using `window.ethereum.isMiniPay` |
| FR-02 | The system must retrieve the user's wallet address implicitly from MiniPay — no connect wallet button shall be displayed |
| FR-03 | The system must enforce one profile per wallet address — duplicate profiles are not permitted |
| FR-04 | If a user accesses CMY outside MiniPay, the system must display an error instructing them to open the app inside MiniPay |
| FR-05 | The system must treat the MiniPay phone-verified wallet as the single source of identity — no additional sign-up form required |

---

### 3.2 Profile Management

| ID | Requirement |
|---|---|
| FR-06 | The system must allow a user to create a profile containing: display name, age, gender, short bio, and at least one profile photo |
| FR-07 | The system must allow a user to upload a minimum of 1 and maximum of 5 profile photos |
| FR-08 | Profile photos must be stored off-chain — only the storage reference pointer is stored in the application database |
| FR-09 | The system must allow a user to edit their display name, bio, and photos at any time |
| FR-10 | The system must allow a user to set their matching preference — the gender they want to match with |
| FR-11 | The system must allow a user to deactivate their profile — deactivated profiles do not appear in discovery |
| FR-12 | The system must validate that the user is at least 18 years old via age input at profile creation |

---

### 3.3 Discovery and Browsing

| ID | Requirement |
|---|---|
| FR-13 | The system must display a discovery feed of profiles matching the user's gender preference |
| FR-14 | The discovery feed must not display profiles the user has already sent a connection request to |
| FR-15 | The discovery feed must not display profiles that have already rejected the user |
| FR-16 | The discovery feed must not display the user's own profile |
| FR-17 | The system must allow a user to view a full profile before deciding to connect |
| FR-18 | The system must display profiles in a randomized order to prevent unfair visibility bias |

---

### 3.4 Connection Request

| ID | Requirement |
|---|---|
| FR-19 | The system must require a cUSD micro-payment to send a connection request |
| FR-20 | The connection request fee must be fixed at a platform-defined amount in cUSD |
| FR-21 | The connection request fee must be transferred to the platform wallet on-chain at the time of request |
| FR-22 | The system must use a smart contract to handle the connection fee transfer |
| FR-23 | If the on-chain transaction fails, the connection request must not be recorded |
| FR-24 | The recipient must receive a notification that a connection request has been received |
| FR-25 | The recipient must be able to accept or decline a connection request |
| FR-26 | If declined, the sender is not refunded — the fee is non-refundable |
| FR-27 | If declined, the sender cannot send another request to the same profile for a minimum of 30 days |
| FR-28 | A mutual match is created only when the recipient explicitly accepts the request |

---

### 3.5 Messaging

| ID | Requirement |
|---|---|
| FR-29 | The system must unlock a private chat between two users only after a mutual match is established |
| FR-30 | Messages must be end-to-end encrypted — the server must never store or access plaintext message content |
| FR-31 | The system must record message session activity metadata only — timestamp of session, not content |
| FR-32 | The system must allow users to send text messages within a matched chat |
| FR-33 | The system must allow a user to unmatch — unmatching ends the chat and removes visibility |
| FR-34 | The system must allow a user to report another user for abusive behavior |
| FR-35 | Reported users must be flagged for platform review — repeated reports trigger automatic temporary suspension |

---

### 3.6 Milestone Engine

| ID | Requirement |
|---|---|
| FR-36 | The system must track behavioral and time-based interaction data per matched pair |
| FR-37 | The system must maintain a milestone library with defined trigger conditions |
| FR-38 | When a milestone condition is met, the system must surface a milestone notification visible to both matched users |
| FR-39 | Milestone fulfillment must be optional — neither user is required to send a gift |
| FR-40 | A milestone may be fulfilled by either user or both users independently |
| FR-41 | Milestone triggers must be rate-limited — the same milestone cannot re-trigger within a defined cooldown window |
| FR-42 | The system must record fulfilled milestones on-chain as immutable events per matched pair |

**Initial Milestone Library (V1):**

| Milestone ID | Name | Trigger Condition |
|---|---|---|
| MS-01 | First Spark | First message sent after matching |
| MS-02 | Breaking The Ice | First reply received — conversation officially started |
| MS-03 | Three Day Streak | Active conversation across 3 consecutive days |
| MS-04 | One Week Strong | Active conversation across 7 consecutive days |
| MS-05 | Two Weeks Together | Active conversation across 14 consecutive days |
| MS-06 | One Month | 30 days since match was created |
| MS-07 | Three Months | 90 days since match was created |
| MS-08 | First Gift Sent | First gift transferred between the pair |
| MS-09 | Gift Returned | Both users have sent each other at least one gift |
| MS-10 | Early Bird | Connection request accepted within 1 hour of being sent |

---

### 3.7 Gift System

| ID | Requirement |
|---|---|
| FR-43 | The system must provide a fixed gift catalogue with platform-defined items and prices |
| FR-44 | Each gift item must have a name, visual representation, and a fixed cUSD price |
| FR-45 | A user must be able to browse the gift catalogue from within a matched chat |
| FR-46 | A user must be able to purchase and send a gift to their match |
| FR-47 | Gift purchase must trigger an on-chain cUSD transfer from sender wallet directly to recipient wallet |
| FR-48 | The recipient must receive 100% of the gift's cUSD value — no platform deduction |
| FR-49 | The platform margin is built into the fixed gift price — not deducted post-transfer |
| FR-50 | The smart contract must handle gift transfers with sender, recipient, gift ID, and amount recorded on-chain |
| FR-51 | The recipient must receive an in-app notification when a gift is received |
| FR-52 | Sent and received gifts must be visible in the chat thread as a distinct visual element |

**Initial Gift Catalogue (V1):**

| Gift ID | Name | cUSD Price |
|---|---|---|
| GF-01 | Warm Heart | $0.50 |
| GF-02 | Red Rose | $1.00 |
| GF-03 | Sweet Candy | $1.50 |
| GF-04 | Gold Star | $2.00 |
| GF-05 | Diamond Ring | $5.00 |

---

### 3.8 Platform Revenue Collection

| ID | Requirement |
|---|---|
| FR-53 | The smart contract must route all connection request fees to a designated platform wallet address |
| FR-54 | The platform wallet must be configurable — only the contract owner can update it |
| FR-55 | The system must maintain an internal log of all connection fees collected |

---

## 4. Non-Functional Requirements

Non-functional requirements define how well the system performs — not what it does, but the quality standards it must meet.

---

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | The Mini App must fully load inside MiniPay within 3 seconds on a standard 3G connection |
| NFR-02 | Profile photos must be compressed to a maximum of 200KB before upload |
| NFR-03 | The discovery feed must load a maximum of 20 profiles per page to prevent heavy data usage |
| NFR-04 | On-chain transactions must confirm within Celo's average block time — approximately 5 seconds |

### 4.2 Security

| ID | Requirement |
|---|---|
| NFR-05 | All smart contracts must be tested against common attack vectors — reentrancy, overflow, unauthorized access |
| NFR-06 | The platform wallet address must only be modifiable by the contract owner |
| NFR-07 | Message content must never be stored in plaintext on any server |
| NFR-08 | User wallet addresses must never be exposed publicly in the frontend without user consent |
| NFR-09 | All cUSD transfer logic must live in the smart contract — never handled client-side only |

### 4.3 Usability

| ID | Requirement |
|---|---|
| NFR-10 | The app must be fully usable on a 5-inch Android screen at 360px viewport width |
| NFR-11 | No action requiring a cUSD payment must execute without an explicit user confirmation step |
| NFR-12 | All cUSD amounts must be displayed in both cUSD and an approximate local currency equivalent where possible |
| NFR-13 | The connect wallet button must be hidden when loaded inside MiniPay |

### 4.4 Reliability

| ID | Requirement |
|---|---|
| NFR-14 | If an on-chain transaction fails, the system must display a clear error message and not record the action |
| NFR-15 | The milestone engine must not trigger duplicate milestone notifications for the same event |
| NFR-16 | The system must handle MiniPay wallet disconnection gracefully without data loss |

### 4.5 Scalability

| ID | Requirement |
|---|---|
| NFR-17 | The off-chain data layer must be capable of handling 10,000 concurrent user profiles without degradation |
| NFR-18 | The smart contract must not store unbounded arrays — all on-chain data structures must be gas-optimized |

### 4.6 Compliance

| ID | Requirement |
|---|---|
| NFR-19 | The app must comply with MiniPay Mini App technical guidelines throughout |
| NFR-20 | The app must only use legacy transactions — EIP-1559 properties must not be used |
| NFR-21 | The app must enforce a minimum user age of 18 at profile creation |

---

## 5. User Stories

User stories capture requirements from the perspective of the end user.

---

**Identity**
- As a MiniPay user, I want to open CMY and be automatically recognized by my wallet so that I don't have to sign up manually.
- As a new user, I want to create a profile with my name, age, bio and photos so that others can discover me.

**Discovery**
- As a user, I want to browse profiles of people who match my preference so that I can find someone I'm interested in.
- As a user, I want to view someone's full profile before deciding to connect so that I can make an informed decision.

**Connection**
- As a user, I want to send a connection request to someone I like so that I can express my interest.
- As a user, I want to know exactly how much cUSD I will spend before confirming a connection request so that I am never surprised by a charge.
- As a user, I want to accept or decline connection requests I receive so that I stay in control of who I talk to.

**Messaging**
- As a matched user, I want to chat privately with my match so that we can get to know each other.
- As a user, I want my messages to be private so that the platform cannot read my conversations.
- As a user, I want to unmatch someone if the conversation is no longer working so that I can move on.

**Milestones**
- As a matched user, I want to see when we reach a relationship milestone so that our connection feels meaningful and recognized.
- As a user, I want milestone gift suggestions to be optional so that I never feel pressured to spend.
- As a user, I want to see milestones my match has fulfilled toward me so that I feel appreciated.

**Gifts**
- As a user, I want to browse a gift catalogue and send a gift to my match so that I can express how I feel in a tangible way.
- As a recipient, I want to receive the full cUSD value of any gift sent to me so that gifting feels genuine and not taxed by the platform.
- As a user, I want to see gifts I have sent and received in our chat so that they become part of our shared history.

---

## 6. Edge Cases

These are scenarios that must be explicitly handled in development:

| Edge Case | Expected System Behavior |
|---|---|
| User sends connection request but cUSD transaction fails on-chain | Request is not recorded. User is shown an error. No fee deducted. |
| User tries to create a second profile with the same wallet | System detects existing profile and routes to profile edit instead |
| User sends a gift but recipient has deactivated their profile | Transaction is blocked before execution. User is notified. |
| Both users simultaneously send each other connection requests | System recognizes mutual interest and creates a match automatically — one fee refunded or waived |
| User under 18 attempts profile creation | System blocks profile creation and displays age restriction message |
| Milestone triggers for a pair where one user has unmatched | Milestone engine checks match status before surfacing — no notification sent to unmatched pair |
| User has insufficient cUSD balance for connection request | System detects balance before transaction attempt and displays insufficient funds message with instructions to top up |
| MiniPay loaded outside supported browser | System displays a message directing user to open inside MiniPay |

---

## 7. Requirements Traceability Matrix

Every Phase 4 feature must trace back to a requirement here. This table will be updated as development progresses.

| Requirement ID | Feature Area | Phase 4 Component |
|---|---|---|
| FR-01 to FR-05 | Authentication | Frontend MiniPay detection logic |
| FR-06 to FR-12 | Profile Management | Profile creation UI + off-chain storage |
| FR-13 to FR-18 | Discovery | Feed component + filtering logic |
| FR-19 to FR-28 | Connection Request | Smart contract + request UI |
| FR-29 to FR-35 | Messaging | E2E encrypted chat component |
| FR-36 to FR-42 | Milestone Engine | Milestone tracking service + notification system |
| FR-43 to FR-52 | Gift System | Gift catalogue UI + smart contract transfer |
| FR-53 to FR-55 | Platform Revenue | Smart contract platform wallet routing |

---

Phase 2 is complete.

Ready to move into **Phase 3 — System Design?**