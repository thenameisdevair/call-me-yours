// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {CMY} from "../src/CMY.sol";

// -----------------------------------------------------------------------------
// Mock USDm — etched at the CMY.USDM constant address.
// Supports opt-in reentrancy against CMY.sendGift for RULE-15 verification.
// -----------------------------------------------------------------------------
contract MockUSDM is ERC20 {
    address public reentrancyTarget;
    address public reentrancyRecipient;
    string public reentrancyGiftType;
    uint256 public reentrancyAmount;
    bool public reentrancyArmed;

    constructor() ERC20("Mock USDm", "USDm") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function armReentrancy(address cmy, address recipient, string calldata giftType, uint256 amount) external {
        reentrancyTarget = cmy;
        reentrancyRecipient = recipient;
        reentrancyGiftType = giftType;
        reentrancyAmount = amount;
        reentrancyArmed = true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (reentrancyArmed) {
            reentrancyArmed = false;
            CMY(reentrancyTarget).sendGift(reentrancyRecipient, reentrancyGiftType, reentrancyAmount);
        }
        return super.transferFrom(from, to, amount);
    }
}

contract CMYTest is Test {
    CMY internal cmy;
    MockUSDM internal usdm;

    address internal owner = address(0xA11CE);
    address internal platform = address(0xBEEF);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xC0FFEE);

    uint256 internal constant INITIAL_FEE = 0.05 ether; // 0.05 USDm (18 decimals)
    uint256 internal constant GIFT_MIN = 1 ether;
    string internal constant GF_02 = "GF-02";

    // Events mirrored from CMY.sol for expectEmit assertions.
    event ConnectionRequestSent(address indexed sender, address indexed recipient, uint256 fee, uint256 timestamp);
    event RequestAccepted(address indexed sender, address indexed recipient, bytes32 matchId, uint256 timestamp);
    event RequestDeclined(address indexed sender, address indexed recipient, uint256 cooldownUntil);
    event MatchCreated(bytes32 indexed matchId, address indexed userA, address indexed userB);
    event GiftSent(
        address indexed sender, address indexed recipient, string giftType, uint256 amount, uint256 timestamp
    );
    event MilestoneFulfilled(
        bytes32 indexed matchId, string milestoneId, address indexed fulfilledBy, uint256 timestamp
    );

    function setUp() public {
        // Deploy MockUSDM then etch its runtime code at CMY.USDM so the
        // hard-coded constant address behaves like our mock in-test.
        MockUSDM template = new MockUSDM();
        address usdmAddr = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
        vm.etch(usdmAddr, address(template).code);
        usdm = MockUSDM(usdmAddr);

        vm.prank(owner);
        cmy = new CMY(platform, INITIAL_FEE);

        vm.prank(owner);
        cmy.updateMinGiftPrice(GF_02, GIFT_MIN);

        // Fund + approve for all actors.
        address[3] memory actors = [alice, bob, carol];
        for (uint256 i = 0; i < actors.length; i++) {
            usdm.mint(actors[i], 1_000 ether);
            vm.prank(actors[i]);
            usdm.approve(address(cmy), type(uint256).max);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _match(address a, address b) internal {
        vm.prank(a);
        cmy.sendConnectionRequest(b);
        vm.prank(b);
        cmy.acceptRequest(a);
    }

    function _matchId(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    // -------------------------------------------------------------------------
    // Connection request
    // -------------------------------------------------------------------------

    function test_sendConnectionRequest_success() public {
        uint256 platformBefore = usdm.balanceOf(platform);
        uint256 aliceBefore = usdm.balanceOf(alice);

        vm.expectEmit(true, true, false, true);
        emit ConnectionRequestSent(alice, bob, INITIAL_FEE, block.timestamp);

        vm.prank(alice);
        cmy.sendConnectionRequest(bob);

        assertEq(usdm.balanceOf(platform), platformBefore + INITIAL_FEE, "platform fee");
        assertEq(usdm.balanceOf(alice), aliceBefore - INITIAL_FEE, "sender debit");

        (address sender, address recipient, uint256 ts, bool accepted, bool declined) = cmy.requests(alice, bob);
        assertEq(sender, alice);
        assertEq(recipient, bob);
        assertEq(ts, block.timestamp);
        assertFalse(accepted);
        assertFalse(declined);
    }

    function test_sendConnectionRequest_revert_selfConnection() public {
        vm.expectRevert(CMY.SelfConnection.selector);
        vm.prank(alice);
        cmy.sendConnectionRequest(alice);
    }

    function test_sendConnectionRequest_revert_alreadyExists() public {
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);

        vm.expectRevert(CMY.RequestAlreadyExists.selector);
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);
    }

    function test_sendConnectionRequest_revert_insufficientApproval() public {
        address dan = address(0xD00D);
        usdm.mint(dan, 1 ether);
        // Deliberately no approval.

        vm.expectRevert(); // SafeERC20 reverts with its own error on missing allowance
        vm.prank(dan);
        cmy.sendConnectionRequest(bob);
    }

    function test_sendConnectionRequest_revert_zeroRecipient() public {
        vm.expectRevert(CMY.ZeroAddress.selector);
        vm.prank(alice);
        cmy.sendConnectionRequest(address(0));
    }

    function test_sendConnectionRequest_revert_alreadyMatched() public {
        _match(alice, bob);
        vm.expectRevert(CMY.AlreadyMatched.selector);
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);
    }

    // -------------------------------------------------------------------------
    // Accept / decline
    // -------------------------------------------------------------------------

    function test_acceptRequest_createsMatch() public {
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);

        bytes32 expectedId = _matchId(alice, bob);

        vm.expectEmit(true, true, false, true);
        emit RequestAccepted(alice, bob, expectedId, block.timestamp);
        vm.expectEmit(true, true, true, false);
        emit MatchCreated(expectedId, alice, bob);

        vm.prank(bob);
        cmy.acceptRequest(alice);

        assertTrue(cmy.matches(alice, bob));
        assertTrue(cmy.matches(bob, alice), "match is symmetric");
    }

    function test_acceptRequest_revert_noRequest() public {
        vm.expectRevert(CMY.RequestNotFound.selector);
        vm.prank(bob);
        cmy.acceptRequest(alice);
    }

    function test_declineRequest_startsCooldown() public {
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);

        uint256 expectedUntil = block.timestamp + cmy.REQUEST_COOLDOWN();

        vm.expectEmit(true, true, false, true);
        emit RequestDeclined(alice, bob, expectedUntil);

        vm.prank(bob);
        cmy.declineRequest(alice);

        assertEq(cmy.cooldowns(alice, bob), expectedUntil);
        assertFalse(cmy.matches(alice, bob));
    }

    function test_reRequest_revert_duringCooldown() public {
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);
        vm.prank(bob);
        cmy.declineRequest(alice);

        uint256 unlocksAt = cmy.cooldowns(alice, bob);

        vm.warp(unlocksAt - 1);
        vm.expectRevert(abi.encodeWithSelector(CMY.CooldownActive.selector, unlocksAt));
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);
    }

    function test_reRequest_succeedsAfterCooldown() public {
        vm.prank(alice);
        cmy.sendConnectionRequest(bob);
        vm.prank(bob);
        cmy.declineRequest(alice);

        vm.warp(cmy.cooldowns(alice, bob) + 1);

        vm.prank(alice);
        cmy.sendConnectionRequest(bob);

        (,,, bool accepted, bool declined) = cmy.requests(alice, bob);
        assertFalse(accepted);
        assertFalse(declined, "new request clears declined flag");
    }

    // -------------------------------------------------------------------------
    // Gifts
    // -------------------------------------------------------------------------

    function test_sendGift_fullAmountToRecipient() public {
        _match(alice, bob);

        uint256 aliceBefore = usdm.balanceOf(alice);
        uint256 bobBefore = usdm.balanceOf(bob);
        uint256 platformBefore = usdm.balanceOf(platform);

        uint256 amount = 2 ether;
        vm.expectEmit(true, true, false, true);
        emit GiftSent(alice, bob, GF_02, amount, block.timestamp);

        vm.prank(alice);
        cmy.sendGift(bob, GF_02, amount);

        assertEq(usdm.balanceOf(alice), aliceBefore - amount, "sender debited full");
        assertEq(usdm.balanceOf(bob), bobBefore + amount, "recipient gets 100%");
        assertEq(usdm.balanceOf(platform), platformBefore, "platform takes zero on gifts");
    }

    function test_sendGift_revert_belowMinimum() public {
        _match(alice, bob);
        uint256 tooLow = GIFT_MIN - 1;
        vm.expectRevert(abi.encodeWithSelector(CMY.InsufficientAmount.selector, tooLow, GIFT_MIN));
        vm.prank(alice);
        cmy.sendGift(bob, GF_02, tooLow);
    }

    function test_sendGift_revert_notMatched() public {
        vm.expectRevert(CMY.NotMatched.selector);
        vm.prank(alice);
        cmy.sendGift(bob, GF_02, GIFT_MIN);
    }

    function test_reentrancy_sendGift() public {
        _match(alice, bob);

        // Arm the mock token so the first transferFrom reenters sendGift.
        usdm.armReentrancy(address(cmy), bob, GF_02, GIFT_MIN);

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(alice);
        cmy.sendGift(bob, GF_02, GIFT_MIN);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function test_updatePlatformWallet_onlyOwner() public {
        vm.prank(owner);
        cmy.updatePlatformWallet(carol);
        assertEq(cmy.platformWallet(), carol);
    }

    function test_updatePlatformWallet_revert_notOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        cmy.updatePlatformWallet(carol);
    }

    function test_updatePlatformWallet_revert_zeroAddress() public {
        vm.expectRevert(CMY.ZeroAddress.selector);
        vm.prank(owner);
        cmy.updatePlatformWallet(address(0));
    }

    function test_updateConnectionFee_onlyOwner() public {
        uint256 newFee = 0.10 ether;
        vm.prank(owner);
        cmy.updateConnectionFee(newFee);
        assertEq(cmy.connectionFee(), newFee);
    }

    function test_updateConnectionFee_revert_notOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        cmy.updateConnectionFee(1 ether);
    }

    function test_updateMinGiftPrice_onlyOwner() public {
        vm.prank(owner);
        cmy.updateMinGiftPrice("GF-05", 5 ether);
        assertEq(cmy.minGiftPrices("GF-05"), 5 ether);
    }

    function test_updateMinGiftPrice_revert_notOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        cmy.updateMinGiftPrice("GF-05", 5 ether);
    }

    // -------------------------------------------------------------------------
    // Milestones
    // -------------------------------------------------------------------------

    function test_recordMilestone_emitsEvent() public {
        _match(alice, bob);

        bytes32 expectedId = _matchId(alice, bob);
        vm.expectEmit(true, true, false, true);
        emit MilestoneFulfilled(expectedId, "MS-03", alice, block.timestamp);

        vm.prank(alice);
        cmy.recordMilestone(bob, "MS-03");
    }

    function test_recordMilestone_revert_notMatched() public {
        vm.expectRevert(CMY.NotMatched.selector);
        vm.prank(alice);
        cmy.recordMilestone(bob, "MS-03");
    }

    // -------------------------------------------------------------------------
    // Constructor sanity
    // -------------------------------------------------------------------------

    function test_constructor_revert_zeroPlatformWallet() public {
        vm.expectRevert(CMY.ZeroAddress.selector);
        new CMY(address(0), INITIAL_FEE);
    }

    function test_matchId_isSymmetric() public {
        _match(alice, bob);
        // Cross-check via bob → carol as well for good measure.
        usdm.mint(bob, 1 ether);
        _match(bob, carol);

        assertEq(_matchId(alice, bob), _matchId(bob, alice), "symmetric");
    }
}
