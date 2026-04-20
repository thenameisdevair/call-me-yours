// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Call Me Yours — core on-chain logic
/// @notice Handles paid connection requests, matched-user gifts, and milestone events.
///         All value transfers flow in USDm (Mento stablecoin on Celo).
contract CMY is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice USDm token on Celo mainnet (Mento stablecoin).
    address public constant USDM = 0x765DE816845861e75A25fCA122bb6898B8B1282a;

    /// @notice 30-day cooldown before a declined sender may re-request the same recipient.
    uint256 public constant REQUEST_COOLDOWN = 30 days;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct ConnectionRequest {
        address sender;
        address recipient;
        uint256 timestamp;
        bool accepted;
        bool declined;
    }

    struct Gift {
        uint256 giftId;
        address sender;
        address recipient;
        uint256 amount;
        uint256 timestamp;
        string giftType;
    }

    struct MilestoneEvent {
        bytes32 matchId;
        string milestoneId;
        uint256 timestamp;
        address fulfilledBy;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Platform wallet — receives all connection fees.
    address public platformWallet;

    /// @notice Current connection-request fee in USDm (18 decimals).
    uint256 public connectionFee;

    /// @notice requests[sender][recipient] — one pending slot per directed pair.
    mapping(address => mapping(address => ConnectionRequest)) public requests;

    /// @notice matches[a][b] is true once either direction has been accepted.
    ///         Symmetric: matches[a][b] == matches[b][a].
    mapping(address => mapping(address => bool)) public matches;

    /// @notice cooldowns[sender][recipient] — unix timestamp when sender may re-request.
    mapping(address => mapping(address => uint256)) public cooldowns;

    /// @notice Minimum accepted USDm amount per gift type (keyed by gift id string).
    mapping(string => uint256) public minGiftPrices;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ConnectionRequestSent(address indexed sender, address indexed recipient, uint256 fee, uint256 timestamp);
    event RequestAccepted(address indexed sender, address indexed recipient, bytes32 matchId, uint256 timestamp);
    event RequestDeclined(address indexed sender, address indexed recipient, uint256 cooldownUntil);
    event MatchCreated(bytes32 indexed matchId, address indexed userA, address indexed userB);
    event GiftSent(
        address indexed sender,
        address indexed recipient,
        string giftType,
        uint256 amount,
        uint256 timestamp
    );
    event MilestoneFulfilled(
        bytes32 indexed matchId,
        string milestoneId,
        address indexed fulfilledBy,
        uint256 timestamp
    );
    event ConnectionFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event MinGiftPriceUpdated(string giftType, uint256 oldPrice, uint256 newPrice);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error SelfConnection();
    error RequestAlreadyExists();
    error RequestNotFound();
    error InsufficientAmount(uint256 provided, uint256 required);
    error CooldownActive(uint256 unlocksAt);
    error NotMatched();
    error AlreadyMatched();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _platformWallet Address that receives connection fees.
    /// @param _initialConnectionFee Initial connection fee in USDm (18 decimals).
    constructor(address _platformWallet, uint256 _initialConnectionFee) Ownable(msg.sender) {
        if (_platformWallet == address(0)) revert ZeroAddress();
        platformWallet = _platformWallet;
        connectionFee = _initialConnectionFee;
    }

    // -------------------------------------------------------------------------
    // Connection flow
    // -------------------------------------------------------------------------

    /// @notice Pay the connection fee in USDm and create a pending request.
    /// @dev Caller must have approved USDM spend of at least `connectionFee`.
    function sendConnectionRequest(address recipient) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == msg.sender) revert SelfConnection();
        if (matches[msg.sender][recipient]) revert AlreadyMatched();

        uint256 cooldownUntil = cooldowns[msg.sender][recipient];
        if (cooldownUntil != 0 && block.timestamp < cooldownUntil) {
            revert CooldownActive(cooldownUntil);
        }

        ConnectionRequest storage existing = requests[msg.sender][recipient];
        if (existing.timestamp != 0 && !existing.accepted && !existing.declined) {
            revert RequestAlreadyExists();
        }

        // Transfer fee to platform wallet (RULE-07).
        IERC20(USDM).safeTransferFrom(msg.sender, platformWallet, connectionFee);

        requests[msg.sender][recipient] = ConnectionRequest({
            sender: msg.sender,
            recipient: recipient,
            timestamp: block.timestamp,
            accepted: false,
            declined: false
        });

        emit ConnectionRequestSent(msg.sender, recipient, connectionFee, block.timestamp);
    }

    /// @notice Recipient accepts a pending request from `sender`, creating a symmetric match.
    function acceptRequest(address sender) external {
        ConnectionRequest storage req = requests[sender][msg.sender];
        if (req.timestamp == 0 || req.accepted || req.declined) revert RequestNotFound();
        if (matches[sender][msg.sender]) revert AlreadyMatched();

        req.accepted = true;
        matches[sender][msg.sender] = true;
        matches[msg.sender][sender] = true;

        bytes32 matchId = _matchId(sender, msg.sender);
        emit RequestAccepted(sender, msg.sender, matchId, block.timestamp);
        emit MatchCreated(matchId, sender, msg.sender);
    }

    /// @notice Recipient declines a pending request; starts a 30-day cooldown for the sender.
    function declineRequest(address sender) external {
        ConnectionRequest storage req = requests[sender][msg.sender];
        if (req.timestamp == 0 || req.accepted || req.declined) revert RequestNotFound();

        req.declined = true;
        uint256 cooldownUntil = block.timestamp + REQUEST_COOLDOWN;
        cooldowns[sender][msg.sender] = cooldownUntil;

        emit RequestDeclined(sender, msg.sender, cooldownUntil);
    }

    // -------------------------------------------------------------------------
    // Gifts
    // -------------------------------------------------------------------------

    /// @notice Send a USDm gift of `amount` to a matched partner.
    /// @dev Recipient receives 100% of the transferred amount (RULE-06).
    function sendGift(address recipient, string calldata giftType, uint256 amount) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == msg.sender) revert SelfConnection();
        if (!matches[msg.sender][recipient]) revert NotMatched();

        uint256 minPrice = minGiftPrices[giftType];
        if (amount < minPrice) revert InsufficientAmount(amount, minPrice);

        IERC20(USDM).safeTransferFrom(msg.sender, recipient, amount);

        emit GiftSent(msg.sender, recipient, giftType, amount, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Milestones
    // -------------------------------------------------------------------------

    /// @notice Record that a milestone was fulfilled between caller and `matchPartner`.
    /// @dev Emits an event only — off-chain indexer persists details.
    function recordMilestone(address matchPartner, string calldata milestoneId) external {
        if (!matches[msg.sender][matchPartner]) revert NotMatched();

        bytes32 matchId = _matchId(msg.sender, matchPartner);
        emit MilestoneFulfilled(matchId, milestoneId, msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function updateConnectionFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = connectionFee;
        connectionFee = newFee;
        emit ConnectionFeeUpdated(oldFee, newFee);
    }

    function updatePlatformWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddress();
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    function updateMinGiftPrice(string calldata giftType, uint256 minPrice) external onlyOwner {
        uint256 oldPrice = minGiftPrices[giftType];
        minGiftPrices[giftType] = minPrice;
        emit MinGiftPriceUpdated(giftType, oldPrice, minPrice);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Deterministic symmetric match id: hash of sorted address pair.
    function _matchId(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
