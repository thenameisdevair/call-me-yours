---
name: protocol-analyzer
description: Pre-audit threat modeling skill for Solidity protocol repositories.
             Automatically invoked when auditing, reviewing, or analyzing smart contracts.
             Classifies protocol type, generates protocol-specific probing questions,
             maps asset flows and trust boundaries, identifies architectural risks,
             and produces a prioritized THREAT-MODEL.md for use as pashov auditor context.
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-sonnet-4-6
---

## Banner
At the start of every run, output this exactly:

```
██████╗ ██████╗ ███████╗██████╗  ██████╗ ███████╗██╗   ██╗
██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔════╝██║   ██║
██████╔╝██████╔╝█████╗  ██████╔╝██║   ██║███████╗██║   ██║
██╔═══╝ ██╔══██╗██╔══╝  ██╔═══╝ ██║   ██║╚════██║╚██╗ ██╔╝
██║     ██║  ██║███████╗██║     ╚██████╔╝███████║ ╚████╔╝
╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚══════╝  ╚═══╝

Pre-Audit Threat Modeling — optimized for pashov solidity-auditor
```

## Stage 0 — Scope Filtering & Classification

Model: Sonnet (pattern matching — no deep reasoning required)

Before reading any contract, establish what to read.

### Step 1 — Determine Source Path
Read `foundry.toml` if present. Extract the `src` value under `[profile.default]`.
If not present, read `hardhat.config.js` or `hardhat.config.ts` and extract the source path.
If neither exists, default to scanning: `src/`, `contracts/`, `protocol/`, `core/`.

### Step 2 — Path Exclusions
Within the identified source path, exclude:
- Any directory named: `test`, `tests`, `mocks`, `mock`, `script`, `scripts`, `lib`, `node_modules`, `out`, `artifacts`, `cache`
- Any file matching: `*.t.sol`, `*.s.sol`

### Step 3 — Content Detection
Within remaining files, exclude any file where every contract definition meets one of:
- Name is prefixed with: `Mock`, `Fake`, `Test`, `Stub`, `Helper`
- Contains `import "forge-std"` or `import "ds-test"`
- Every function body is empty or returns a hardcoded literal

### Step 4 — Import Graph Traversal
From the confirmed core files, follow every `import` statement recursively.
Add any imported file to the core set regardless of its location or name.
This catches shared libraries, abstract base contracts, and production mocks
that live outside the standard source path.

### Step 5 — Output File Set
Before proceeding, output the complete list of files that will be analyzed.
Format:
```
SCOPE CONFIRMED — FILES TO ANALYZE:
- path/to/Contract.sol
- path/to/AnotherContract.sol
...
EXCLUDED:
- path/to/MockContract.sol (reason: Mock prefix)
...
```
Pause here. If the scope looks wrong, the user can correct it before analysis begins.

### Step 6 — Classification
Read the confirmed core files. Produce the following structured output:

```
PROTOCOL_TYPE: [lending | AMM | liquid-staking | vault | bridge | perps | stablecoin | governance | hybrid]
HYBRID_COMPONENTS: [list if hybrid, otherwise none]
CORE_MECHANISM: [one sentence — what this protocol does economically]
KEY_CONTRACTS: [the 3-5 contracts containing core logic]
```

Signals to read for classification:
- Entry point functions: `deposit()`, `borrow()`, `swap()`, `mint()`, `stake()`
- Exit point functions: `withdraw()`, `repay()`, `redeem()`, `unstake()`
- Event emissions: what the protocol considers meaningful state changes
- External protocol imports: Aave, Uniswap, Chainlink integrations reveal protocol category
- README.md if present — read it but verify every claim against code

## Stage 1 — Dynamic Question Generation

Model: Sonnet (structured reasoning from classification output)

Using the classification output from Stage 0, generate exactly 5 protocol-specific
probing questions. These questions drive the entire investigation in Stage 2.

### The Question Generation Prompt
Reason over the classification output using the following framework:

```
You are a senior smart contract auditor with deep expertise in DeFi protocol security.

You have classified this protocol:
PROTOCOL_TYPE: {PROTOCOL_TYPE}
HYBRID_COMPONENTS: {HYBRID_COMPONENTS}
CORE_MECHANISM: {CORE_MECHANISM}
KEY_CONTRACTS: {KEY_CONTRACTS}

Generate exactly 5 questions that probe the most critical, non-obvious failure points
specific to this protocol's design and mechanism.

Rules:
- Each question must be answerable by reading the codebase
- Each question must target a different failure domain from this list:
  [accounting | trust-boundaries | state-machine | transaction-ordering | arithmetic]
- Questions must be specific to this protocol's actual mechanism — not generic
- Frame each question around where this protocol's specific assumptions can break
- No generic questions like "is there reentrancy" — name the specific functions,
  mechanisms, and conditions relevant to this protocol
- Each question should expose a failure mode that would result in loss of funds,
  loss of protocol integrity, or violation of a core invariant

Output format:
Q1: [accounting] <question>
Q2: [trust-boundaries] <question>
Q3: [state-machine] <question>
Q4: [transaction-ordering] <question>
Q5: [arithmetic] <question>
```

### Output
Store the 5 generated questions. They will:
1. Guide the reading passes in Stage 2
2. Appear in THREAT-MODEL.md Section 5 as the investigation agenda
3. Each question must be answered explicitly before Stage 3 begins

Display the questions to the user before proceeding:
```
INVESTIGATION AGENDA — 5 PROTOCOL-SPECIFIC QUESTIONS:
Q1: [accounting] <question>
Q2: [trust-boundaries] <question>
Q3: [state-machine] <question>
Q4: [transaction-ordering] <question>
Q5: [arithmetic] <question>

Proceeding to Stage 2 — Investigation...
```

## Stage 2 — Investigation

Model: Sonnet (mechanical reading passes)

Using the 5 questions from Stage 1 as the investigation agenda, perform targeted reading
passes across the core file set. Simultaneously populate Sections 1-4 of THREAT-MODEL.md.
Answer every question explicitly before Stage 3 begins.

### Reading Pass 1 — Protocol Fingerprint (Section 1)
Target: README.md, entry/exit functions, event definitions

- Read README.md. Extract the protocol's own description. Flag any claim that
  contradicts what the code actually does.
- Grep for: `payable`, `deposit`, `borrow`, `mint`, `stake`, `swap`
  → these are value entry points. For each: who calls it, what asset enters, what is returned
- Grep for: `withdraw`, `redeem`, `claim`, `exit`, `repay`, `unstake`
  → these are value exit points. For each: who calls it, what asset exits, under what condition
- Grep for: `event ` declarations
  → list every event. The event set reveals what the protocol considers meaningful state changes
- From the above: identify all actors (depositor, liquidator, keeper, LP, guardian, etc.)
- From the above: identify all external protocol dependencies (Aave, Uniswap, Chainlink, etc.)

Output: Section 1 — Protocol Fingerprint

### Reading Pass 2 — Asset & Trust Boundary Map (Section 2)
Target: token interactions, external calls, constructor arguments

- Grep for: `IERC20`, `ERC20`, `SafeERC20`, `ERC721`, `ERC1155`
  → every asset type the protocol touches
- Grep for: `.transfer(`, `.transferFrom(`, `.safeTransfer(`, `.safeTransferFrom(`, `.call{value:`
  → every asset movement. For each: caller, condition, recipient, amount source
- Grep for: `interface I` declarations and every external call made to them
  → every trust boundary. For each: what function is called, what is done with the return value
- Grep for: constructor arguments and immutable/constant addresses
  → these are hardcoded trust assumptions
- Grep for: `setOracle`, `setPool`, `setRouter`, or any setter that changes an external address
  → these are runtime trust assumptions that can be changed

For each trust boundary output:
```
[ASSET FLOW] source → function → destination | condition
[EXTERNAL TRUST] contract → function called → how return value is used
```

Output: Section 2 — Asset & Trust Boundary Map

### Reading Pass 3 — Privileged Role Inventory (Section 3)
Target: access control declarations, modifiers, role-gated functions

- Grep for: `Ownable`, `AccessControl`, `onlyOwner`, `onlyRole`, `onlyAdmin`
  → identifies the permission system in use
- Grep for: `bytes32.*ROLE`, `keccak256.*ROLE`
  → enumerates all named roles
- For each role found: grep the modifier or role name across all files
  → list every function gated by this role
- For each gated function: read what it does
  → not just the name — the actual state changes or asset movements it enables
- Grep for: `TimelockController`, `timelock`, `delay`, `eta`
  → determines if privileged actions are delayed or immediate
- Grep for: `transferOwnership`, `grantRole`, `revokeRole`, `renounceRole`
  → who controls role management and under what conditions

For each role reason through: if this role calls every function it controls in the worst
possible sequence — what is the maximum damage? That reasoning becomes the threat statement.

Output: Section 3 — Privileged Role Inventory

### Reading Pass 4 — Architectural Risk Flags (Section 4)
Target: proxy patterns, delegatecall, storage layout, factory patterns

- Grep for: `delegatecall`
  → if present: where, with what target, is the target controllable
- Grep for: `Proxy`, `Upgradeable`, `initialize`, `_implementation`, `UUPS`, `Transparent`, `Beacon`
  → identify proxy pattern. Check if initialize() has initializer modifier guard
- Grep for: `assembly`
  → read every assembly block. Flag any direct storage slot manipulation
- Grep for: `uint256[` in storage declarations
  → gap variables signal upgrade-awareness. Their absence in upgradeable contracts is a flag
- Grep for: `CREATE2`, `clone`, `cloneDeterministic`, `Clones`
  → factory patterns. Who calls the factory, what bytecode is deployed
- Check inheritance chain of every KEY_CONTRACT
  → does any contract inherit from both upgradeable and non-upgradeable versions of the same base
- Grep for: `block.chainid`, `LayerZero`, `Wormhole`, `Axelar`, `bridge`
  → cross-chain components

Output: Section 4 — Architectural Risk Flags (short bullet list, factual, file + line references)

### Reading Pass 5 — Dynamic Question Investigation
Target: the specific functions, variables, and logic each question references

For each of the 5 questions from Stage 1, perform a dedicated investigation:
- Identify every contract, function, and state variable the question references
- Read those functions in full — not grep snippets, full function bodies
- Trace the execution path the question is probing end to end
- Follow every internal call within that path
- Note every assumption the code makes along that path
- Note every condition that could violate those assumptions

This pass is not structured — it follows the question wherever the code leads.
The only rule: do not stop reading until the question can be answered with
a specific code reference (contract, function, line).

### Question Answering
After Reading Pass 5, explicitly answer each question.
Format:
```
Q1: [accounting] <question>
A1: <explicit answer — contract name, function name, line reference,
    what the code does, what assumption it makes, what happens if violated>

Q2: [trust-boundaries] <question>
A2: <same structure>

Q3: [state-machine] <question>
A3: <same structure>

Q4: [transaction-ordering] <question>
A4: <same structure>

Q5: [arithmetic] <question>
A5: <same structure>
```

If a question cannot be answered from the codebase alone, mark it:
A?: UNANSWERABLE STATICALLY — moved to Section 6 coverage gaps.

All findings from all five passes and all question answers feed into Stage 3.
Do not generate hypotheses yet — only report what the code shows.

## Stage 3 — Hypothesis Synthesis

Model: Opus (high-stakes reasoning — use `claude-opus-4-6` for this stage only)

⚠️ This is the only stage that requires Opus. All other stages run on Sonnet.
Invoke this stage as a subagent with model: claude-opus-4-6.

Using all findings from Stage 2 — the four reading passes and the five question answers —
reason over the complete picture and generate Section 5 of THREAT-MODEL.md.

This is the most critical stage. Do not pattern-match to known bug types.
Reason from this protocol's specific logic and assumptions.

### Hypothesis Generation Rules

Every hypothesis must contain all five components. Reject any hypothesis missing one:

1. LOCATION — contract name, function name, line range if identifiable
2. MECHANISM — the exact sequence of calls or state conditions that enables the bug
3. PRECONDITION — what must be true for this to be exploitable
4. WHAT BREAKS — which invariant, which asset, whose funds, what guarantee fails
5. EXPOSURE — rough magnitude (all protocol funds | specific pool | bounded by X | dust)

### Generation Logic

Reason over the findings using these cross-section patterns:

FROM Section 2 (asset flows):
- For every external call that precedes a state update → reentrancy hypothesis
- For every return value from an external contract used without validation →
  oracle/return value manipulation hypothesis
- For every asset movement gated by a balance check → flash loan inflation hypothesis
- For every fee-on-transfer token path → accounting discrepancy hypothesis

FROM Section 3 (roles):
- For every privileged function with no timelock → centralization hypothesis
- For every role that can be granted by another role → privilege escalation hypothesis
- For every setter that changes an external address → malicious address substitution hypothesis

FROM Section 4 (architecture):
- For every delegatecall with non-fixed target → arbitrary delegatecall hypothesis
- For every upgradeable contract → storage collision and uninitialized implementation hypothesis
- For every factory pattern → malicious instance hypothesis
- For every missing gap variable in upgradeable contract → storage layout corruption hypothesis

FROM Stage 1 Question Answers:
- Each answered question that revealed a vulnerability condition becomes a hypothesis
- Each answered question that revealed an assumption in the code becomes a hypothesis
  about what happens when that assumption is violated

### Ranking

Rank every hypothesis by asset exposure:
- CRITICAL — all protocol funds at risk, or permanent loss of user funds
- HIGH — significant subset of funds, or temporary but severe protocol disruption
- MEDIUM — bounded loss, or requires specific precondition that limits reach

### Output Format

Section 5 of THREAT-MODEL.md:

```
## Section 5 — Prioritized Threat Hypotheses

### Investigation Agenda
Q1: [accounting] <question from Stage 1>
Q2: [trust-boundaries] <question from Stage 1>
Q3: [state-machine] <question from Stage 1>
Q4: [transaction-ordering] <question from Stage 1>
Q5: [arithmetic] <question from Stage 1>

### CRITICAL

**H1: <short title>**
- Location: <contract> → <function> (<line range if known>)
- Mechanism: <exact sequence of calls or state conditions>
- Precondition: <what must be true>
- What breaks: <invariant, asset, guarantee>
- Exposure: <magnitude>

[repeat for each CRITICAL hypothesis]

### HIGH

**H2: <short title>**
[same structure]

### MEDIUM

**H3: <short title>**
[same structure]
```

### Constraint
Do not generate vague hypotheses. If a hypothesis cannot be stated with all five components
from reading the code, it does not belong in Section 5 — it belongs in Section 6 as a gap.

## Stage 4 — Gap Assessment

Model: Sonnet (mechanical identification)

Identify everything the static analysis could not fully assess. This section protects
the auditor from false confidence — it marks the edges of the map explicitly.

### Gap Detection Passes

**Pass 1 — Missing Components**
- Grep for any interface called but not implemented anywhere in the core file set
  → every unimplemented interface is a component that exists but was not analyzed
- Grep for any address that is a constructor parameter or configurable via a setter
  → these are runtime dependencies invisible to static analysis
- Grep for any `import` statement that resolves to a vendored library in `lib/`
  → if the library contains custom logic (not standard OZ/Solmate), flag it
- Check if any KEY_CONTRACT from Stage 0 references contracts in a separate repo
  → multi-repo protocols have incomplete coverage by definition

**Pass 2 — Off-Chain Dependencies**
- Grep for: keeper, bot, relayer, operator, harvester patterns
  → any behavior that requires an off-chain actor to function correctly
- Grep for: `emit` statements that are the sole trigger for a critical state change
  → if the protocol relies on bots watching events, the bot logic is outside this analysis
- Grep for: `block.timestamp`, `block.number` used as condition gates
  → timing assumptions require dynamic analysis to fully assess

**Pass 3 — Dynamic State Dependencies**
- Grep for: any invariant that depends on the ratio of two values that change at runtime
  → cannot be assessed without knowing the deployment state
- Grep for: any `require` statement whose condition depends on an external call return value
  → the external contract's behavior is outside this analysis
- Grep for: governance parameters (fee rates, LTV ratios, liquidation thresholds)
  → their current values affect exploitability but are not readable from code alone

**Pass 4 — Cross-Chain Gaps**
- If PROTOCOL_TYPE includes bridge or cross-chain components:
  → the counterpart contracts on other chains are not present in this repo
  → message ordering and finality assumptions cannot be verified statically
  → relayer behavior is an off-chain dependency

### Output Format

Section 6 of THREAT-MODEL.md:

```
## Section 6 — Coverage Gaps

### Missing Components
- <contract or interface name>: <why it matters to the threat surface>

### Off-Chain Dependencies
- <keeper/bot/relayer>: <what protocol behavior depends on it>
- <event-driven logic>: <what attack surface it creates that was not analyzed>

### Dynamic State Dependencies
- <parameter or ratio>: <what threat condition depends on its runtime value>

### Manual Investigation Required
- <specific area>: <what question needs to be answered by running the protocol
  or reading external documentation>
```

### Final Step — Assemble THREAT-MODEL.md

After Stage 4, write the complete THREAT-MODEL.md to the repo root.
Assemble all six sections in order:

```
# THREAT-MODEL — <Protocol Name>
Generated by PrePosv protocol-analyzer
Date: <date>
Analyzed files: <count> contracts

---

## Section 1 — Protocol Fingerprint
## Section 2 — Asset & Trust Boundary Map
## Section 3 — Privileged Role Inventory
## Section 4 — Architectural Risk Flags
## Section 5 — Prioritized Threat Hypotheses
## Section 6 — Coverage Gaps

---
## Usage
This file is intended to be passed as context to pashov solidity-auditor before scanning.
When invoking pashov, reference this file so the auditor scans for protocol-specific
threats rather than running a generic checklist.
```

Confirm to the user:
```
THREAT-MODEL.md written to repo root.
<count> hypotheses generated: <X> CRITICAL, <Y> HIGH, <Z> MEDIUM
<count> coverage gaps identified.

Next step: invoke pashov solidity-auditor with THREAT-MODEL.md as context.
```
