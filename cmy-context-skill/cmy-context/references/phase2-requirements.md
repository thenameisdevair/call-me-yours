# CMY Phase 2 — Requirements Analysis

## Functional Requirements

### Authentication and Identity
- FR-01: Detect MiniPay using `window.ethereum.isMiniPay`
- FR-02: Retrieve wallet address implicitly — no connect button
- FR-03: Enforce one profile per wallet address
- FR-04: Show error if accessed outside MiniPay
- FR-05: MiniPay phone-verified wallet is sole identity source

### Profile Management
- FR-06: Profile contains display name, age, gender, bio, minimum one photo
- FR-07: Minimum 1, maximum 5 profile photos
- FR-08: Photos stored off-chain — only storage reference in database
- FR-09: User can edit display name, bio, photos at any time
- FR-10: User sets matching preference (gender seeking)
- FR-11: User can deactivate profile — hidden from discovery
- FR-12: Age minimum 18 enforced at profile creation

### Discovery
- FR-13: Discovery feed shows profiles matching gender preference
- FR-14: Feed excludes profiles already sent a request to
- FR-15: Feed excludes profiles that have rejected the user
- FR-16: Feed excludes own profile
- FR-17: User can view full profile before connecting
- FR-18: Feed displayed in randomized order

### Connection Request
- FR-19: Connection request requires USDm micro-payment
- FR-20: Connection fee is fixed platform-defined amount
- FR-21: Fee transferred to platform wallet on-chain at request time
- FR-22: Smart contract handles connection fee transfer
- FR-23: Failed on-chain tx = request not recorded
- FR-24: Recipient receives notification of request
- FR-25: Recipient can accept or decline
- FR-26: Declined requests are non-refundable
- FR-27: Declined sender cannot re-request for 30 days
- FR-28: Mutual match created only on explicit acceptance

### Messaging
- FR-29: Private chat unlocked only after mutual match
- FR-30: Messages E2E encrypted via XMTP — server never sees plaintext
- FR-31: Only session metadata stored (timestamp, count) — never content
- FR-32: Users can send text messages in matched chat
- FR-33: User can unmatch — ends chat, removes visibility
- FR-34: User can report another user
- FR-35: Repeated reports trigger automatic temporary suspension

### Milestone Engine
- FR-36: Track behavioral and time-based interaction data per match
- FR-37: Maintain milestone library with defined trigger conditions
- FR-38: Surface milestone notification visible to both users when triggered
- FR-39: Milestone fulfillment is optional — never forced
- FR-40: Milestone may be fulfilled by either or both users
- FR-41: Same milestone cannot re-trigger within cooldown window
- FR-42: Fulfilled milestones recorded on-chain as immutable events

### Milestone Library (V1)
| ID | Name | Trigger |
|---|---|---|
| MS-01 | First Spark | First message sent after matching |
| MS-02 | Breaking The Ice | First reply received |
| MS-03 | Three Day Streak | Active conversation 3 consecutive days |
| MS-04 | One Week Strong | Active conversation 7 consecutive days |
| MS-05 | Two Weeks Together | Active conversation 14 consecutive days |
| MS-06 | One Month | 30 days since match created |
| MS-07 | Three Months | 90 days since match created |
| MS-08 | First Gift Sent | First gift transferred between the pair |
| MS-09 | Gift Returned | Both users sent each other at least one gift |
| MS-10 | Early Bird | Connection accepted within 1 hour of being sent |

### Gift System
- FR-43: Fixed gift catalogue with platform-defined items and prices
- FR-44: Each gift has name, visual, fixed USDm price
- FR-45: User can browse catalogue from within matched chat
- FR-46: User can purchase and send a gift to their match
- FR-47: Gift purchase triggers on-chain USDm transfer sender → recipient
- FR-48: Recipient receives 100% of gift USDm value — no deduction
- FR-49: Platform margin embedded in fixed price — not deducted post-transfer
- FR-50: Smart contract records sender, recipient, gift ID, amount on-chain
- FR-51: Recipient receives in-app notification when gift received
- FR-52: Gifts visible in chat thread as distinct visual element

### Gift Catalogue (V1)
| ID | Name | USDm Price |
|---|---|---|
| GF-01 | Warm Heart | $0.50 |
| GF-02 | Red Rose | $1.00 |
| GF-03 | Sweet Candy | $1.50 |
| GF-04 | Gold Star | $2.00 |
| GF-05 | Diamond Ring | $5.00 |

### Platform Revenue
- FR-53: Smart contract routes connection fees to platform wallet
- FR-54: Platform wallet configurable by owner only
- FR-55: Internal log of all connection fees collected

---

## Non-Functional Requirements

### Performance
- NFR-01: Mini App loads within 3 seconds on 3G connection
- NFR-02: Profile photos compressed to max 200KB before upload
- NFR-03: Discovery feed loads max 20 profiles per page
- NFR-04: On-chain transactions confirm within ~5 seconds (Celo average)

### Security
- NFR-05: Contracts tested against reentrancy, overflow, unauthorized access
- NFR-06: Platform wallet only modifiable by contract owner
- NFR-07: Message content never stored in plaintext on any server
- NFR-08: Wallet addresses never exposed publicly without user consent
- NFR-09: All USDm transfer logic lives in smart contract — never client-side only

### Usability
- NFR-10: Fully usable on 5-inch Android screen at 360px viewport width
- NFR-11: No USDm payment executes without explicit user confirmation
- NFR-12: All USDm amounts displayed clearly before transaction
- NFR-13: Connect wallet button hidden inside MiniPay

### Reliability
- NFR-14: Failed on-chain tx shows clear error — never records the action
- NFR-15: Milestone engine never fires duplicate notifications
- NFR-16: MiniPay disconnection handled gracefully without data loss

### Scalability
- NFR-17: Off-chain layer handles 10,000 concurrent profiles without degradation
- NFR-18: Smart contract uses gas-optimized data structures — no unbounded arrays

### Compliance
- NFR-19: App complies with MiniPay Mini App technical guidelines
- NFR-20: Legacy transactions only — no EIP-1559
- NFR-21: Minimum age 18 enforced at profile creation

---

## Edge Cases

| Edge Case | Expected Behavior |
|---|---|
| Connection request tx fails on-chain | Request not recorded. Error shown. No fee deducted. |
| User tries to create second profile | Detected — routed to profile edit instead |
| User sends gift to deactivated profile | Transaction blocked before execution. User notified. |
| Both users send each other connection requests simultaneously | System creates match automatically |
| User under 18 attempts profile creation | Blocked with age restriction message |
| Milestone triggers for unmatched pair | Engine checks match status — no notification sent |
| Insufficient USDm balance | System detects before tx attempt — deep-links to add cash |
| App loaded outside MiniPay | Error screen with instruction to open inside MiniPay |
