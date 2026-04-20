

# SDLC Phase 4 — Implementation
## Call Me Yours (CMY)

---

## Overview

Phase 4 is not one continuous build session. It is **10 sequential steps**, each
with a clear input, a Claude Code instruction, and a defined output. Each step
must be complete and verified before the next begins. Every step produces at
least one commit to GitHub.

The CMY skill loaded in `.claude/skills/cmy-context/` is your agent's context
throughout. Claude Code reads it automatically — you do not re-explain the
project on each step.

---

## Pre-Build Checklist

Before starting Step 1, verify all of the following:

```bash
# 1. Correct directory
pwd
# Expected: ~/Documents/Call me Yours

# 2. CMY skill installed
ls .claude/skills/
# Expected: cmy-context  impeccable

# 3. Celo agent skills installed globally
ls ~/.claude/skills/ | grep -E "minipay|viem|fee-abstraction|evm-foundry"
# Expected: all four listed

# 4. Git configured
git remote -v
# Expected: origin https://github.com/thenameisdevair/call-me-yours.git

# 5. On dev branch
git branch
# Expected: * dev

# 6. Project runs
pnpm dev
# Expected: Next.js running on localhost:3000
```

---

## Step 1 — Environment Configuration

**Branch:** `chore/env-config`

**Goal:** Configure all environment variables, Next.js headers for XMTP
browser SDK compatibility, and Foundry network configuration before any code is
written.

**Claude Code instruction:**
```
Using the cmy-context skill, configure the CMY project environment:

1. Create apps/web/.env.local with these variables:
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_CMY_CONTRACT_ADDRESS=
   NEXT_PUBLIC_CELO_RPC=https://forno.celo.org
   NEXT_PUBLIC_USDM_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
   NEXT_PUBLIC_USDM_ADAPTER=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
   NEXT_PUBLIC_XMTP_ENV=dev

2. Create apps/web/.env.example with the same keys but empty values

3. Update apps/web/next.config.ts to:
   - Add Cross-Origin-Embedder-Policy: require-corp header
   - Add Cross-Origin-Opener-Policy: same-origin header
   (Required for @xmtp/browser-sdk WASM and OPFS support)

4. Create apps/contracts/.env with:
   PRIVATE_KEY=
   CELOSCAN_API_KEY=

5. Update apps/contracts/foundry.toml with Celo Sepolia and Celo Mainnet
   network configurations using the correct RPC endpoints and chain IDs
   from the cmy-context skill

6. Add .env* and .env.local to .gitignore — never commit secrets
```

**Commit:**
```bash
git add .
git commit -m "chore(config): configure env variables and XMTP Next.js headers"
git commit -m "chore(config): configure Foundry networks for Celo Sepolia and Mainnet"
```

---

## Step 2 — Smart Contract

**Branch:** `feat/smart-contract-core`

**Goal:** Write, test, and deploy CMY.sol to Celo Sepolia testnet.

### Step 2a — Write the Contract

**Claude Code instruction:**
```
Using the cmy-context skill, write the CMY smart contract at
apps/contracts/src/CMY.sol.

The contract must implement exactly what is specified in phase3-design.md:

1. Imports: OpenZeppelin ReentrancyGuard, Ownable, IERC20
2. Constants: USDM address, CONNECTION_FEE initial value
3. Custom errors: SelfConnection, RequestAlreadyExists, RequestNotFound,
   InsufficientAmount, CooldownActive, NotMatched, AlreadyMatched
4. Structs: ConnectionRequest, Gift, MilestoneEvent
5. State: platformWallet, connectionFee, mappings for requests/matches/
   cooldowns/minGiftPrices
6. Functions: sendConnectionRequest, acceptRequest, declineRequest,
   sendGift, recordMilestone, updateConnectionFee, updatePlatformWallet,
   updateMinGiftPrice
7. Events: ConnectionRequestSent, RequestAccepted, RequestDeclined,
   MatchCreated, GiftSent, MilestoneFulfilled
8. All USDm transfer functions must use nonReentrant modifier
9. Use custom errors — never revert strings
10. All admin functions must use onlyOwner
11. Gift recipient receives 100% of amount — platform margin is never
    deducted in the contract
```

**Commit:**
```bash
git commit -m "feat(contract): implement CMY.sol with connection, gift, milestone modules"
```

### Step 2b — Write Foundry Tests

**Claude Code instruction:**
```
Using the cmy-context skill, write comprehensive Foundry tests at
apps/contracts/test/CMY.t.sol covering:

1. Setup: deploy mock USDm ERC20, deploy CMY contract, fund test users
2. Connection request tests:
   - test_sendConnectionRequest_success
   - test_sendConnectionRequest_revert_selfConnection
   - test_sendConnectionRequest_revert_alreadyExists
   - test_sendConnectionRequest_revert_insufficientApproval
3. Accept/decline tests:
   - test_acceptRequest_createsMatch
   - test_declineRequest_startsCooldown
   - test_reRequest_revert_duringCooldown
4. Gift tests:
   - test_sendGift_fullAmountToRecipient
   - test_sendGift_revert_belowMinimum
   - test_sendGift_revert_notMatched
   - test_reentrancy_sendGift (verify nonReentrant works)
5. Admin tests:
   - test_updatePlatformWallet_onlyOwner
   - test_updateConnectionFee_onlyOwner
   - test_updateMinGiftPrice_onlyOwner
   - test_updatePlatformWallet_revert_notOwner
6. Milestone tests:
   - test_recordMilestone_emitsEvent
   - test_recordMilestone_revert_notMatched

Run: forge test -vvv
All tests must pass before proceeding.
```

**Commit:**
```bash
git commit -m "test(contract): add comprehensive Foundry test suite for CMY.sol"
```

### Step 2c — Deploy to Celo Sepolia

**Before this step — get testnet tokens:**
```bash
# 1. Get testnet CELO from faucet
# Visit: https://faucet.celo.org/celo-sepolia
# Enter your deployer wallet address

# 2. Swap CELO for USDm on testnet
# Visit: https://app.mento.org
# Connect testnet wallet, swap CELO → USDm
```

**Claude Code instruction:**
```
Using the cmy-context skill, write the deployment script at
apps/contracts/script/Deploy.s.sol.

The script must:
1. Read PRIVATE_KEY from environment
2. Deploy CMY.sol with constructor args:
   - platformWallet (deployer address initially)
   - initialConnectionFee (0.05 USDm = 50000000000000000)
3. Set initial gift prices for all 5 gifts (GF-01 through GF-05)
4. Log deployed contract address

Then run:
forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org \
  --broadcast \
  --verify \
  --etherscan-api-key $CELOSCAN_API_KEY

Save the deployed contract address to .env.local as
NEXT_PUBLIC_CMY_CONTRACT_ADDRESS
```

**Commit:**
```bash
git commit -m "feat(contract): add deployment script for CMY.sol"
git commit -m "deploy(contract): deploy CMY.sol to Celo Sepolia — [address]"
```

---

## Step 3 — Supabase Schema Setup

**Branch:** `chore/database-schema`

**Goal:** Create all database tables, RLS policies, and storage bucket in
Supabase.

**Before this step:**
1. Create a Supabase project at https://supabase.com
2. Copy project URL and anon key to `.env.local`

**Claude Code instruction:**
```
Using the cmy-context skill, create the complete Supabase database setup:

1. Create apps/web/lib/supabase.ts with the Supabase client configuration
   using environment variables

2. Create apps/web/lib/database.types.ts with TypeScript types generated
   from the schema in phase3-design.md

3. Create a migration file at supabase/migrations/001_initial_schema.sql
   containing all table definitions from phase3-design.md:
   - profiles (with age CHECK >= 18)
   - matches
   - connection_requests
   - chat_sessions
   - milestones
   - reports

4. Add Row Level Security policies:
   - profiles: users can only update their own profile
   - matches: users can only read matches they are part of
   - connection_requests: sender can create, recipient can update status
   - chat_sessions: only matched users can insert/read
   - milestones: only matched users can insert/read
   - reports: authenticated users can insert

5. Create storage bucket named 'photos' with:
   - Max file size: 5MB (we compress to 200KB before upload but allow headroom)
   - Allowed MIME types: image/jpeg, image/png, image/webp
   - Public read access for profile photos
```

**Commit:**
```bash
git commit -m "chore(db): create initial schema migration with all CMY tables"
git commit -m "chore(db): add RLS policies for all tables"
git commit -m "chore(db): configure Supabase storage bucket for profile photos"
git commit -m "chore(db): add Supabase client and database TypeScript types"
```

---

## Step 4 — MiniPay Detection and Wallet Integration

**Branch:** `feat/minipay-auth`

**Goal:** Implement the core MiniPay detection hook and wallet connection.
This is the foundation every other feature depends on.

**Claude Code instruction:**
```
Using the cmy-context skill, implement MiniPay detection and wallet
integration:

1. Install dependencies:
   pnpm add viem wagmi @celo/abis

2. Create apps/web/lib/viem.ts:
   - createWalletClient configured for Celo mainnet
   - createPublicClient for reading chain state
   - Helper: checkUSDmBalance(address) using exact code from MiniPay
     code library
   - Helper: checkTransactionSuccess(hash)
   - All clients use feeCurrency: USDM_ADAPTER on transactions

3. Create apps/web/hooks/useMiniPay.ts:
   - Detect window.ethereum.isMiniPay on mount
   - If not MiniPay: set isMiniPay = false
   - If MiniPay: get address implicitly via eth_requestAccounts
   - Expose: { isMiniPay, address, isLoading, error }

4. Create apps/web/lib/contracts.ts:
   - CMY contract ABI (full ABI from CMY.sol)
   - CMY contract address from environment variable
   - USDm contract ABI (ERC20 standard)
   - Helper functions: sendConnectionRequest, sendGift, recordMilestone
     all using legacy tx type + feeCurrency: USDM_ADAPTER

5. Update apps/web/app/layout.tsx:
   - Call useMiniPay on root load
   - If isMiniPay is false: render full-screen error:
     "Please open Call Me Yours inside MiniPay"
   - If isMiniPay is true: render children

6. Update apps/web/app/page.tsx:
   - Check Supabase for existing profile using wallet address
   - If profile exists: redirect to /discover
   - If no profile: redirect to /onboard
```

**Commit:**
```bash
git commit -m "feat(auth): implement MiniPay detection hook"
git commit -m "feat(auth): add viem clients with feeCurrency USDm configuration"
git commit -m "feat(auth): add CMY contract interaction helpers"
git commit -m "feat(auth): add root layout MiniPay gate and profile routing"
```

---

## Step 5 — Profile Creation

**Branch:** `feat/profile-setup`

**Goal:** Build the full profile creation flow — form, photo upload with
compression, and Supabase write.

**Claude Code instruction:**
```
Using the cmy-context skill and impeccable design skill, build the profile
creation flow:

1. Install: pnpm add browser-image-compression

2. Create apps/web/app/onboard/page.tsx:
   - Multi-step form (Step 1: name + age + gender + seeking, Step 2: bio,
     Step 3: photo upload)
   - Age validation: block if < 18 with clear message
   - Gender field: male/female only (V1 scope)
   - Seeking field: male/female only

3. Create apps/web/components/PhotoUpload.tsx:
   - Accept 1-5 photos
   - Compress each photo to max 200KB using browser-image-compression
     before upload
   - Upload compressed files to Supabase Storage 'photos' bucket
   - Store returned public URLs in state
   - Show preview thumbnails
   - Show upload progress

4. On form submit:
   - Validate all required fields
   - Ensure at least one photo uploaded
   - Write profile to Supabase profiles table with wallet_address
   - On success: redirect to /discover

5. Apply Impeccable design system:
   - Warm, intimate aesthetic
   - DM Serif Display for headings
   - Plus Jakarta Sans for body text
   - Mobile-first layout (360px min)
   - No generic AI appearance
```

**Commit:**
```bash
git commit -m "feat(profile): build multi-step profile creation form"
git commit -m "feat(profile): add 200KB photo compression before Supabase upload"
git commit -m "feat(profile): add age validation — enforce 18+ minimum"
git commit -m "style(ui): apply Impeccable design to onboarding flow"
```

---

## Step 6 — Discovery Feed

**Branch:** `feat/discovery-feed`

**Goal:** Build the profile discovery feed with filtering, exclusion logic,
and full profile view.

**Claude Code instruction:**
```
Using the cmy-context skill and impeccable design skill, build the discovery
feed:

1. Create apps/web/hooks/useProfiles.ts:
   - Fetch profiles from Supabase matching user's seeking preference
   - Exclude: own profile, already-requested profiles, rejected profiles
   - Randomize order on each load
   - Paginate: 20 profiles per page
   - Expose: { profiles, isLoading, loadMore, hasMore }

2. Create apps/web/app/discover/page.tsx:
   - Card-based profile feed
   - Each card shows: first photo, display name, age
   - Tap card → navigate to full profile view
   - Pull to refresh
   - Load more on scroll

3. Create apps/web/app/profile/[address]/page.tsx:
   - Show all profile photos (swipeable gallery)
   - Display name, age, bio
   - "Connect" button → triggers connection request flow
   - Back navigation

4. Create apps/web/components/ProfileCard.tsx:
   - Lazy-loaded photo
   - Display name and age overlay
   - Warm, intimate card design

5. Apply Impeccable design:
   - Card layout optimized for mobile
   - Photo-first design
   - Smooth transitions between cards
   - No clinical swiping mechanic — tap-to-view is intentional
```

**Commit:**
```bash
git commit -m "feat(discovery): build profile feed with gender preference filtering"
git commit -m "feat(discovery): add exclusion logic for existing requests and rejections"
git commit -m "feat(discovery): build full profile view with photo gallery"
git commit -m "style(ui): apply Impeccable design to discovery feed"
```

---

## Step 7 — Connection Request Flow

**Branch:** `feat/connection-request`

**Goal:** Implement the full connection request flow — USDm balance check,
approval, on-chain fee transfer, Supabase record, and incoming request
management.

**Claude Code instruction:**
```
Using the cmy-context skill, implement the connection request flow:

1. Create apps/web/components/ConnectionButton.tsx:
   - On tap: check USDm balance against CONNECTION_FEE
   - If insufficient: deep-link to https://minipay.opera.com/add_cash
   - If sufficient: show confirmation modal displaying exact fee amount
   - User confirms → check/request USDm approval for CMY contract
   - Execute CMY.sendConnectionRequest(recipient) with:
     - Legacy transaction type
     - feeCurrency: USDM_ADAPTER
   - If tx fails: show error, nothing recorded
   - If tx succeeds: write to Supabase connection_requests with tx hash
   - Show success state

2. Create apps/web/app/requests/page.tsx:
   - List incoming pending connection requests
   - Each request shows sender profile photo, name, age
   - Accept button → calls CMY.acceptRequest(sender)
     - On success: create match in Supabase matches table
     - Redirect to matches page
   - Decline button → calls CMY.declineRequest(sender)
     - On success: update request status to declined
     - Record cooldown start timestamp

3. Create apps/web/hooks/useConnectionRequest.ts:
   - Encapsulate all connection request logic
   - Balance check, approval, contract call, DB write
   - Handle all error states with clear user messages

4. Add navigation badge on requests tab showing pending count
```

**Commit:**
```bash
git commit -m "feat(connection): implement USDm balance check and add cash deeplink"
git commit -m "feat(connection): build connection request confirmation modal"
git commit -m "feat(connection): implement USDm approval and on-chain fee transfer"
git commit -m "feat(connection): build incoming requests page with accept/decline"
git commit -m "feat(connection): add 30-day cooldown enforcement"
```

---

## Step 8 — XMTP Chat Integration

**Branch:** `feat/xmtp-chat`

**Goal:** Integrate XMTP V3 browser SDK for E2E encrypted matched chat.

**Claude Code instruction:**
```
Using the cmy-context skill, integrate XMTP V3 for encrypted messaging:

1. Install: pnpm add @xmtp/browser-sdk

2. Verify next.config.ts has the required COOP/COEP headers:
   Cross-Origin-Embedder-Policy: require-corp
   Cross-Origin-Opener-Policy: same-origin
   (These were added in Step 1 — verify they exist)

3. Create apps/web/hooks/useXMTP.ts:
   - Initialize XMTP V3 client using @xmtp/browser-sdk
   - Create EOA signer from MiniPay wallet address
   - Client.create(signer, { env: process.env.NEXT_PUBLIC_XMTP_ENV })
   - findOrCreateDm(recipientInboxId) for matched users
   - Stream incoming messages
   - Send messages
   - Note: Primary identifier in V3 is inboxId, not Ethereum address —
     use client.inboxId for all conversation lookups

4. Create apps/web/app/chat/[matchId]/page.tsx:
   - Match-gated access: verify match exists in Supabase before rendering
   - Load XMTP conversation with match partner
   - Display message history (text only, V1)
   - Message input at bottom
   - Send button
   - Gift button → opens gift catalogue overlay

5. Create apps/web/hooks/useChatSession.ts:
   - When user sends a message: record session metadata in Supabase
     chat_sessions table (date only, no content)
   - Increment message_count for the day
   - After each session record: call milestone engine check

6. Create apps/web/app/matches/page.tsx:
   - List all active matches
   - Show match partner photo, name
   - Show last message preview (from XMTP, not Supabase)
   - Tap to open chat

7. IMPORTANT: Never store message content in Supabase.
   Only store: match_id, session_date, message_count
```

**Commit:**
```bash
git commit -m "feat(chat): integrate XMTP V3 browser-sdk for E2E messaging"
git commit -m "feat(chat): build match-gated chat page with XMTP conversation"
git commit -m "feat(chat): add chat session metadata tracking in Supabase"
git commit -m "feat(chat): build matches list page with last message preview"
```

---

## Step 9 — Milestone Engine and Gift System

**Branch:** `feat/milestone-engine`
**Branch:** `feat/gift-system`

### Step 9a — Milestone Engine

**Claude Code instruction:**
```
Using the cmy-context skill, implement the milestone engine:

1. Create apps/web/lib/milestoneEngine.ts:
   - Define full milestone library (MS-01 through MS-10) from
     phase2-requirements.md
   - checkMilestones(matchId): queries chat_sessions and matches from
     Supabase, evaluates all milestone conditions, returns triggered
     milestones not yet recorded
   - hasConsecutiveDays(sessions, n): checks if sessions span n
     consecutive calendar days
   - Rate limit: never return a milestone that already exists in the
     milestones table for this match

2. Create apps/web/hooks/useMilestones.ts:
   - Run checkMilestones after every chat session update
   - Store triggered milestones in local state
   - Expose: { pendingMilestones, dismissMilestone, fulfillMilestone }

3. Create apps/web/components/MilestoneNotification.tsx:
   - Appears when a milestone is triggered
   - Shows milestone name, description, gift suggestion
   - "Send Gift" button → opens gift catalogue filtered to match context
   - "Maybe Later" button → dismisses without recording
   - Visible to both users independently (each user's client checks)
   - Warm, celebratory design — feels like a moment, not an alert
```

**Commit:**
```bash
git commit -m "feat(milestone): implement milestone library and trigger engine"
git commit -m "feat(milestone): add consecutive day streak detection"
git commit -m "feat(milestone): build milestone notification component"
```

### Step 9b — Gift System

**Branch:** `feat/gift-system`

**Claude Code instruction:**
```
Using the cmy-context skill, implement the gift system:

1. Create apps/web/constants/gifts.ts:
   Define the full V1 gift catalogue (GF-01 through GF-05):
   - GF-01: Warm Heart — 0.50 USDm
   - GF-02: Red Rose — 1.00 USDm
   - GF-03: Sweet Candy — 1.50 USDm
   - GF-04: Gold Star — 2.00 USDm
   - GF-05: Diamond Ring — 5.00 USDm

2. Create apps/web/components/GiftCatalogue.tsx:
   - Display all 5 gifts with names, visual icons, and USDm prices
   - Each gift shows minimum price with option to send more
   - User taps gift → sees confirmation: "Send [name] worth X USDm?"
   - On confirm:
     a. Check USDm balance >= gift price
     b. If insufficient: deep-link to add cash
     c. Approve USDm spend for CMY contract
     d. Call CMY.sendGift(recipient, giftType, amount) with
        legacy tx + feeCurrency: USDM_ADAPTER
     e. On tx success: write to Supabase milestones table if
        milestone-triggered, show gift in chat thread
   - Recipient receives full USDm amount — never deduct

3. Create apps/web/components/GiftMessage.tsx:
   - Renders gift as a distinct visual element inside chat thread
   - Shows gift icon, name, and USDm amount
   - Warm, celebratory visual — not a generic transaction notification

4. After successful gift send:
   - Call CMY.recordMilestone(matchPartner, milestoneId) if
     gift fulfills a pending milestone
   - Update Supabase milestones table with fulfillment details
   - Dismiss the milestone notification
```

**Commit:**
```bash
git commit -m "feat(gift): define V1 gift catalogue with USDm prices"
git commit -m "feat(gift): build gift catalogue UI with confirmation flow"
git commit -m "feat(gift): implement on-chain gift send with full amount to recipient"
git commit -m "feat(gift): add gift rendering in chat thread"
git commit -m "feat(gift): connect gift fulfillment to milestone recording"
```

---

## Step 10 — UI Polish and Production Readiness

**Branch:** `feat/ui-polish`

**Goal:** Apply Impeccable design system across all screens, verify MiniPay
compatibility, and prepare for deployment.

### Step 10a — Design Polish

**Claude Code instruction:**
```
Using the impeccable skill, audit and polish the entire CMY UI:

1. Run /audit across all pages — fix every flagged issue

2. Apply consistent design system:
   - Typography: DM Serif Display for all headings, Plus Jakarta Sans
     for body text and UI elements
   - Color palette: warm tones, NOT blockchain-green, NOT neon-on-dark
   - Spacing: consistent rhythm throughout
   - Mobile-first: every screen tested at 360px width

3. Run /polish on:
   - Onboarding flow
   - Discovery feed
   - Profile view
   - Connection request confirmation modal
   - Chat screen
   - Gift catalogue
   - Milestone notification

4. Run /delight on:
   - Match creation success state
   - Gift send success state
   - Milestone trigger animation
   (Delight should enhance, never distract from usability)

5. Verify every screen:
   - No Connect Wallet button visible anywhere inside MiniPay
   - All USDm amounts clearly displayed before any transaction
   - Loading states on all async operations
   - Error states on all failure conditions
   - Empty states (no matches yet, no requests yet)
```

**Commit:**
```bash
git commit -m "style(ui): apply Impeccable audit fixes across all screens"
git commit -m "style(ui): implement consistent typography system"
git commit -m "style(ui): add delight animations to match and gift success states"
git commit -m "style(ui): add empty states and loading states to all async views"
```

### Step 10b — MiniPay Compatibility Verification

**Claude Code instruction:**
```
Using the cmy-context skill, run the MiniPay compatibility checklist:

1. Verify window.ethereum.isMiniPay detection on every page entry
2. Verify no ConnectButton rendered anywhere when isMiniPay is true
3. Verify all transactions use legacy type with feeCurrency: USDM_ADAPTER
4. Verify insufficient balance always deep-links to
   https://minipay.opera.com/add_cash
5. Verify profile photos lazy-load and compress to <200KB
6. Verify discovery feed loads max 20 items per page
7. Verify XMTP COOP/COEP headers are set in next.config.ts
8. Run Lighthouse performance audit — target score >70 on mobile

Set up ngrok for MiniPay physical device testing:
ngrok http 3000

Load the ngrok URL in MiniPay Developer Mode on an Android device
and manually test the full user flow end to end.
```

**Commit:**
```bash
git commit -m "chore(config): verify MiniPay compatibility across all features"
git commit -m "perf(ui): optimize bundle size and lazy loading for 3G performance"
```

---

## Step 11 — Mainnet Deployment

**Only execute this step when all of the following are true:**
- All Foundry tests pass
- Full flow tested on Celo Sepolia
- Full flow tested inside MiniPay on physical Android device
- Impeccable audit has zero flagged issues
- No console errors in production build

### Step 11a — Deploy Contract to Mainnet

```bash
# Fund deployer wallet with small CELO amount (~$2-3 worth)
# Then deploy:

forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo.org \
  --broadcast \
  --verify \
  --etherscan-api-key $CELOSCAN_API_KEY

# Update .env.local with mainnet contract address
# NEXT_PUBLIC_CMY_CONTRACT_ADDRESS=[mainnet address]
```

**Commit:**
```bash
git commit -m "deploy(contract): deploy CMY.sol to Celo Mainnet — [address]"
git commit -m "chore(config): update contract address to Celo Mainnet"
```

### Step 11b — Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard
# Submit URL to MiniPay app discovery page
```

**Commit:**
```bash
git commit -m "deploy(frontend): deploy CMY to Vercel production"
git commit -m "chore(config): update XMTP env to production for mainnet"
```

---

## Phase 4 Summary

| Step | Feature | Branch | Key Commit Pattern |
|---|---|---|---|
| 1 | Environment config | `chore/env-config` | `chore(config):` |
| 2 | Smart contract | `feat/smart-contract-core` | `feat(contract):`, `test(contract):`, `deploy(contract):` |
| 3 | Database schema | `chore/database-schema` | `chore(db):` |
| 4 | MiniPay auth | `feat/minipay-auth` | `feat(auth):` |
| 5 | Profile creation | `feat/profile-setup` | `feat(profile):` |
| 6 | Discovery feed | `feat/discovery-feed` | `feat(discovery):` |
| 7 | Connection request | `feat/connection-request` | `feat(connection):` |
| 8 | XMTP chat | `feat/xmtp-chat` | `feat(chat):` |
| 9 | Milestones + gifts | `feat/milestone-engine`, `feat/gift-system` | `feat(milestone):`, `feat(gift):` |
| 10 | UI polish | `feat/ui-polish` | `style(ui):`, `perf(ui):` |
| 11 | Mainnet deployment | `main` | `deploy(contract):`, `deploy(frontend):` |

---

## Important Reminders For Every Step

1. **Always on `dev` branch** before creating a feature branch
2. **Always merge back to `dev`** when a step is complete
3. **Never build directly on `main`** — main is production only
4. **Always commit before moving to the next step** — never carry uncommitted
   changes across steps
5. **CMY skill is always active** — Claude Code reads it automatically, you do
   not need to re-explain the project
6. **Every transaction** — legacy type + feeCurrency: USDM_ADAPTER — no
   exceptions