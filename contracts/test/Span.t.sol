// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Span} from "../Span.sol";

/// @dev 6-decimal ERC20 with an optional blocklist: transfers TO a blocked address revert.
contract MockUSDC {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;

    error Blocklisted(address who);

    function setBlocked(address a, bool b) external { blocked[a] = b; }

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
        totalSupply += amt;
    }

    function approve(address s, uint256 amt) external returns (bool) {
        allowance[msg.sender][s] = amt;
        return true;
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        _move(msg.sender, to, amt);
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amt;
        _move(from, to, amt);
        return true;
    }

    function _move(address from, address to, uint256 amt) internal {
        if (blocked[to]) revert Blocklisted(to);
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
    }
}

contract SpanTest is Test {
    Span internal span;
    MockUSDC internal token;

    address internal host = makeAddr("host");
    address internal guest = makeAddr("guest");
    address internal other = makeAddr("other");

    uint128 internal constant AMT = 100e6;
    uint64 internal constant T0 = 1_000_000;
    uint64 internal constant VIEW = T0 + 1 days;
    uint256 internal constant DAY = 24 hours;
    uint256 internal constant WEEK = 7 days;
    bytes32 internal constant REF = keccak256("ref");

    function setUp() public {
        vm.warp(T0);
        token = new MockUSDC();
        span = new Span(IERC20(address(token)));
        address[3] memory us = [host, guest, other];
        for (uint256 i; i < 3; i++) {
            token.mint(us[i], type(uint128).max);
            vm.prank(us[i]);
            token.approve(address(span), type(uint256).max);
        }
    }

    // ---------- helpers ----------
    function _open() internal returns (uint256 id) {
        vm.prank(host);
        id = span.open(AMT, VIEW, address(0), REF);
    }

    function _lock() internal returns (uint256 id) {
        id = _open();
        vm.prank(guest);
        span.pay(id);
    }

    function _disputed() internal returns (uint256 id) {
        id = _lock();
        vm.warp(VIEW);
        vm.prank(guest);
        span.dispute(id);
    }

    function _wrong(uint256 id, Span.Status exp, Span.Status act) internal {
        vm.expectRevert(abi.encodeWithSelector(Span.WrongStatus.selector, id, exp, act));
    }

    function _status(uint256 id) internal view returns (Span.Status) {
        return span.getDeal(id).status;
    }

    function _stats(address a) internal view returns (uint32 c, uint32 w, uint32 dr, uint32 drc) {
        return span.stats(a);
    }

    // ---------- deployment ----------
    function test_NextIdStartsAtOne() public view {
        assertEq(span.nextId(), 1);
        assertEq(address(span.usdc()), address(token));
    }

    function test_ConstructorZeroTokenReverts() public {
        vm.expectRevert(Span.InvalidToken.selector);
        new Span(IERC20(address(0)));
    }

    // ---------- open ----------
    function test_Open_StoresDealAndPullsBond() public {
        vm.expectEmit(true, true, true, true, address(span));
        emit Span.Opened(1, host, guest, AMT, VIEW, REF);
        vm.prank(host);
        uint256 id = span.open(AMT, VIEW, guest, REF);
        assertEq(id, 1);
        assertEq(span.nextId(), 2);
        Span.Deal memory d = span.getDeal(1);
        assertEq(d.host, host);
        assertEq(d.guest, address(0));
        assertEq(d.allowedGuest, guest);
        assertEq(d.amount, AMT);
        assertEq(d.viewingAt, VIEW);
        assertEq(uint8(d.status), uint8(Span.Status.Open));
        assertEq(d.ref, REF);
        assertEq(token.balanceOf(address(span)), AMT);
    }

    function test_Open_IncrementsIds() public {
        assertEq(_open(), 1);
        assertEq(_open(), 2);
        assertEq(span.nextId(), 3);
    }

    function test_Open_ZeroAmountReverts() public {
        vm.prank(host);
        vm.expectRevert(Span.InvalidAmount.selector);
        span.open(0, VIEW, address(0), REF);
    }

    function test_Open_ViewingNowOrPastReverts() public {
        vm.startPrank(host);
        vm.expectRevert(Span.InvalidViewingTime.selector);
        span.open(AMT, T0, address(0), REF);
        vm.expectRevert(Span.InvalidViewingTime.selector);
        span.open(AMT, T0 - 1, address(0), REF);
        span.open(AMT, T0 + 1, address(0), REF); // one second ahead is fine
        vm.stopPrank();
    }

    // ---------- cancel ----------
    function test_Cancel_HostRecoversBond() public {
        uint256 id = _open();
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Cancelled(id);
        vm.prank(host);
        span.cancel(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(host), AMT);
    }

    function test_Cancel_NonHostReverts() public {
        uint256 id = _open();
        vm.prank(guest);
        vm.expectRevert(Span.HostOnly.selector);
        span.cancel(id);
    }

    function test_Cancel_DoubleCancelReverts() public {
        uint256 id = _open();
        vm.prank(host);
        span.cancel(id);
        _wrong(id, Span.Status.Open, Span.Status.Closed);
        vm.prank(host);
        span.cancel(id);
        assertEq(span.credits(host), AMT);
    }

    function test_Cancel_AfterPayReverts() public {
        uint256 id = _lock();
        _wrong(id, Span.Status.Open, Span.Status.Locked);
        vm.prank(host);
        span.cancel(id);
    }

    // ---------- pay ----------
    function test_Pay_LocksGuestBond() public {
        uint256 id = _open();
        vm.expectEmit(true, true, false, true, address(span));
        emit Span.Paid(id, guest);
        vm.prank(guest);
        span.pay(id);
        Span.Deal memory d = span.getDeal(id);
        assertEq(d.guest, guest);
        assertEq(uint8(d.status), uint8(Span.Status.Locked));
        assertEq(token.balanceOf(address(span)), 2 * AMT);
    }

    function test_Pay_HostCannotPay() public {
        uint256 id = _open();
        vm.prank(host);
        vm.expectRevert(Span.HostCannotPay.selector);
        span.pay(id);
    }

    function test_Pay_AllowedGuestEnforced() public {
        vm.prank(host);
        uint256 id = span.open(AMT, VIEW, guest, REF);
        vm.prank(other);
        vm.expectRevert(Span.GuestNotAllowed.selector);
        span.pay(id);
        vm.prank(guest);
        span.pay(id);
        assertEq(span.getDeal(id).guest, guest);
    }

    function test_Pay_ZeroAllowedGuestMeansAnyone() public {
        uint256 id = _open();
        vm.prank(other);
        span.pay(id);
        assertEq(span.getDeal(id).guest, other);
    }

    function test_Pay_AtViewingAtReverts() public {
        uint256 id = _open();
        vm.warp(VIEW);
        vm.prank(guest);
        vm.expectRevert(Span.ViewingAlreadyStarted.selector);
        span.pay(id);
    }

    function test_Pay_AfterViewingAtReverts() public {
        uint256 id = _open();
        vm.warp(VIEW + 1 hours);
        vm.prank(guest);
        vm.expectRevert(Span.ViewingAlreadyStarted.selector);
        span.pay(id);
    }

    function test_Pay_OneSecondBeforeViewingOk() public {
        uint256 id = _open();
        vm.warp(VIEW - 1);
        vm.prank(guest);
        span.pay(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Locked));
    }

    function test_Pay_DoublePayReverts() public {
        uint256 id = _lock();
        _wrong(id, Span.Status.Open, Span.Status.Locked);
        vm.prank(other);
        span.pay(id);
    }

    function test_Pay_CancelledDealReverts() public {
        uint256 id = _open();
        vm.prank(host);
        span.cancel(id);
        _wrong(id, Span.Status.Open, Span.Status.Closed);
        vm.prank(guest);
        span.pay(id);
    }

    // ---------- guestWalkAway ----------
    function test_GuestWalkAway_HostGetsBothBonds() public {
        uint256 id = _lock();
        vm.expectEmit(true, true, true, true, address(span));
        emit Span.WalkedAway(id, guest, host);
        vm.prank(guest);
        span.guestWalkAway(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(host), 2 * AMT);
        assertEq(span.credits(guest), 0);
        (, uint32 w,,) = _stats(guest);
        assertEq(w, 1);
        (, uint32 wh,,) = _stats(host);
        assertEq(wh, 0);
    }

    function test_GuestWalkAway_NonGuestReverts() public {
        uint256 id = _lock();
        vm.prank(host);
        vm.expectRevert(Span.GuestOnly.selector);
        span.guestWalkAway(id);
        vm.prank(other);
        vm.expectRevert(Span.GuestOnly.selector);
        span.guestWalkAway(id);
    }

    function test_GuestWalkAway_AtViewingAtReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW);
        vm.prank(guest);
        vm.expectRevert(Span.ViewingAlreadyStarted.selector);
        span.guestWalkAway(id);
    }

    function test_GuestWalkAway_OneSecondBeforeOk() public {
        uint256 id = _lock();
        vm.warp(VIEW - 1);
        vm.prank(guest);
        span.guestWalkAway(id);
        assertEq(span.credits(host), 2 * AMT);
    }

    function test_GuestWalkAway_OnOpenAndDoubleReverts() public {
        uint256 id = _open();
        _wrong(id, Span.Status.Locked, Span.Status.Open);
        vm.prank(guest);
        span.guestWalkAway(id);

        uint256 id2 = _lock();
        vm.prank(guest);
        span.guestWalkAway(id2);
        _wrong(id2, Span.Status.Locked, Span.Status.Closed);
        vm.prank(guest);
        span.guestWalkAway(id2);
    }

    // ---------- hostWalkAway ----------
    function test_HostWalkAway_GuestGetsBothBonds() public {
        uint256 id = _lock();
        vm.expectEmit(true, true, true, true, address(span));
        emit Span.WalkedAway(id, host, guest);
        vm.prank(host);
        span.hostWalkAway(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(guest), 2 * AMT);
        assertEq(span.credits(host), 0);
        (, uint32 w,,) = _stats(host);
        assertEq(w, 1);
        (, uint32 wg,,) = _stats(guest);
        assertEq(wg, 0);
    }

    function test_HostWalkAway_NonHostReverts() public {
        uint256 id = _lock();
        vm.prank(guest);
        vm.expectRevert(Span.HostOnly.selector);
        span.hostWalkAway(id);
    }

    function test_HostWalkAway_AllowedAfterViewing() public {
        uint256 id = _lock();
        vm.warp(VIEW + 2 hours);
        vm.prank(host);
        span.hostWalkAway(id);
        assertEq(span.credits(guest), 2 * AMT);
    }

    function test_HostWalkAway_OnOpenAndDoubleReverts() public {
        uint256 id = _open();
        _wrong(id, Span.Status.Locked, Span.Status.Open);
        vm.prank(host);
        span.hostWalkAway(id);

        uint256 id2 = _lock();
        vm.prank(host);
        span.hostWalkAway(id2);
        _wrong(id2, Span.Status.Locked, Span.Status.Closed);
        vm.prank(host);
        span.hostWalkAway(id2);
    }

    // ---------- confirm ----------
    function test_Confirm_HostGetsBothBondsStatsCompleted() public {
        uint256 id = _lock();
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Confirmed(id);
        vm.prank(guest);
        span.confirm(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(host), 2 * AMT);
        assertEq(span.credits(guest), 0);
        (uint32 ch,,,) = _stats(host);
        (uint32 cg,,,) = _stats(guest);
        assertEq(ch, 1);
        assertEq(cg, 1);
    }

    function test_Confirm_NonGuestReverts() public {
        uint256 id = _lock();
        vm.prank(host);
        vm.expectRevert(Span.GuestOnly.selector);
        span.confirm(id);
    }

    function test_Confirm_DoubleReverts() public {
        uint256 id = _lock();
        vm.prank(guest);
        span.confirm(id);
        _wrong(id, Span.Status.Locked, Span.Status.Closed);
        vm.prank(guest);
        span.confirm(id);
    }

    // ---------- release ----------
    function test_Release_AnyoneAtExactlyViewingPlus24h() public {
        uint256 id = _lock();
        vm.warp(VIEW + DAY);
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Released(id);
        vm.prank(other);
        span.release(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(host), 2 * AMT);
        (uint32 ch,,,) = _stats(host);
        (uint32 cg,,,) = _stats(guest);
        assertEq(ch, 1);
        assertEq(cg, 1);
    }

    function test_Release_BeforeWindowEndReverts() public {
        uint256 id = _lock();
        vm.expectRevert(Span.DisputeWindowNotClosed.selector);
        span.release(id);
        vm.warp(VIEW + DAY - 1);
        vm.expectRevert(Span.DisputeWindowNotClosed.selector);
        span.release(id);
    }

    function test_Release_DoubleReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW + DAY);
        span.release(id);
        _wrong(id, Span.Status.Locked, Span.Status.Closed);
        span.release(id);
    }

    // ---------- dispute ----------
    function test_Dispute_ExactlyViewingAtOk() public {
        uint256 id = _lock();
        vm.warp(VIEW);
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Disputed(id);
        vm.prank(guest);
        span.dispute(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Disputed));
        (,, uint32 drg, uint32 drcg) = _stats(guest);
        (,, uint32 drh, uint32 drch) = _stats(host);
        assertEq(drg, 1);
        assertEq(drcg, 0);
        assertEq(drh, 0);
        assertEq(drch, 1);
    }

    function test_Dispute_OneBeforeViewingAtReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW - 1);
        vm.prank(guest);
        vm.expectRevert(Span.DisputeWindowNotOpen.selector);
        span.dispute(id);
    }

    function test_Dispute_LastSecondOk() public {
        uint256 id = _lock();
        vm.warp(VIEW + DAY - 1);
        vm.prank(guest);
        span.dispute(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Disputed));
    }

    function test_Dispute_ExactlyWindowEndReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW + DAY);
        vm.prank(guest);
        vm.expectRevert(Span.DisputeWindowNotOpen.selector);
        span.dispute(id);
    }

    function test_Dispute_NonGuestReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW);
        vm.prank(host);
        vm.expectRevert(Span.GuestOnly.selector);
        span.dispute(id);
    }

    function test_Dispute_DoubleReverts() public {
        uint256 id = _disputed();
        _wrong(id, Span.Status.Locked, Span.Status.Disputed);
        vm.prank(guest);
        span.dispute(id);
    }

    function test_DisputedDealCannotConfirmReleaseOrWalk() public {
        uint256 id = _disputed();
        vm.warp(VIEW + DAY);
        vm.startPrank(guest);
        _wrong(id, Span.Status.Locked, Span.Status.Disputed);
        span.confirm(id);
        _wrong(id, Span.Status.Locked, Span.Status.Disputed);
        span.release(id);
        _wrong(id, Span.Status.Locked, Span.Status.Disputed);
        span.guestWalkAway(id);
        vm.stopPrank();
        _wrong(id, Span.Status.Locked, Span.Status.Disputed);
        vm.prank(host);
        span.hostWalkAway(id);
    }

    // ---------- proposeSplit ----------
    function test_Propose_NonPartyReverts() public {
        uint256 id = _disputed();
        vm.prank(other);
        vm.expectRevert(Span.PartiesOnly.selector);
        span.proposeSplit(id, 10);
    }

    function test_Propose_ExceedsAmountReverts() public {
        uint256 id = _disputed();
        vm.prank(host);
        vm.expectRevert(Span.InvalidSplit.selector);
        span.proposeSplit(id, AMT + 1);
        vm.prank(guest);
        vm.expectRevert(Span.InvalidSplit.selector);
        span.proposeSplit(id, type(uint128).max);
    }

    function test_Propose_NotDisputedReverts() public {
        uint256 id = _lock();
        _wrong(id, Span.Status.Disputed, Span.Status.Locked);
        vm.prank(host);
        span.proposeSplit(id, 1);
    }

    function test_Propose_MismatchThenMatchSettles() public {
        uint256 id = _disputed();
        vm.expectEmit(true, true, false, true, address(span));
        emit Span.SplitProposed(id, host, 30e6);
        vm.prank(host);
        span.proposeSplit(id, 30e6);
        vm.prank(guest);
        span.proposeSplit(id, 40e6);
        assertEq(uint8(_status(id)), uint8(Span.Status.Disputed));
        assertEq(span.credits(guest), 0);
        assertEq(span.credits(host), 0);

        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Settled(id, 30e6, 2 * AMT - 30e6);
        vm.prank(guest);
        span.proposeSplit(id, 30e6);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(guest), 30e6);
        assertEq(span.credits(host), 2 * AMT - 30e6);
    }

    function test_Propose_HostThenGuestOrder() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 25e6);
        vm.prank(guest);
        span.proposeSplit(id, 25e6);
        assertEq(span.credits(guest), 25e6);
        assertEq(span.credits(host), 2 * AMT - 25e6);
    }

    function test_Propose_GuestThenHostOrder() public {
        uint256 id = _disputed();
        vm.prank(guest);
        span.proposeSplit(id, 25e6);
        vm.prank(host);
        span.proposeSplit(id, 25e6);
        assertEq(span.credits(guest), 25e6);
        assertEq(span.credits(host), 2 * AMT - 25e6);
    }

    function test_Propose_ZeroToGuestEdge() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 0);
        assertEq(uint8(_status(id)), uint8(Span.Status.Disputed)); // 0 is a real proposal, not "unset"
        vm.prank(guest);
        span.proposeSplit(id, 0);
        assertEq(span.credits(guest), 0);
        assertEq(span.credits(host), 2 * AMT);
    }

    function test_Propose_FullAmountToGuestEdge() public {
        uint256 id = _disputed();
        vm.prank(guest);
        span.proposeSplit(id, AMT);
        vm.prank(host);
        span.proposeSplit(id, AMT);
        assertEq(span.credits(guest), AMT);
        assertEq(span.credits(host), AMT);
    }

    function test_Propose_ReProposalOverwrites() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 10e6);
        vm.prank(host);
        span.proposeSplit(id, 20e6); // overwrites 10e6
        vm.prank(guest);
        span.proposeSplit(id, 10e6); // must NOT match the stale 10e6
        assertEq(uint8(_status(id)), uint8(Span.Status.Disputed));
        vm.prank(guest);
        span.proposeSplit(id, 20e6); // matches the new host proposal
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(guest), 20e6);
        assertEq(span.credits(host), 2 * AMT - 20e6);
    }

    function test_Propose_GuestReProposalMatchesHost() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 20e6);
        vm.prank(guest);
        span.proposeSplit(id, 50e6);
        vm.prank(guest);
        span.proposeSplit(id, 20e6);
        assertEq(span.credits(guest), 20e6);
    }

    function test_Propose_AfterSettleReverts() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 5e6);
        vm.prank(guest);
        span.proposeSplit(id, 5e6);
        _wrong(id, Span.Status.Disputed, Span.Status.Closed);
        vm.prank(host);
        span.proposeSplit(id, 5e6);
    }

    // ---------- timeout ----------
    function test_Timeout_BeforeDeadlineReverts() public {
        uint256 id = _disputed();
        vm.expectRevert(Span.TimeoutNotReached.selector);
        span.timeout(id);
        vm.warp(VIEW + DAY + WEEK - 1);
        vm.expectRevert(Span.TimeoutNotReached.selector);
        span.timeout(id);
    }

    function test_Timeout_ExactDeadlineAnyoneRefundsEach() public {
        uint256 id = _disputed();
        vm.warp(VIEW + DAY + WEEK);
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.TimedOut(id);
        vm.prank(other);
        span.timeout(id);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        assertEq(span.credits(host), AMT);
        assertEq(span.credits(guest), AMT);
        assertEq(span.credits(other), 0);
    }

    function test_Timeout_NoProposeAfterAndNoDouble() public {
        uint256 id = _disputed();
        vm.warp(VIEW + DAY + WEEK);
        span.timeout(id);
        _wrong(id, Span.Status.Disputed, Span.Status.Closed);
        vm.prank(host);
        span.proposeSplit(id, 1);
        _wrong(id, Span.Status.Disputed, Span.Status.Closed);
        span.timeout(id);
    }

    function test_Timeout_NotDisputedReverts() public {
        uint256 id = _lock();
        vm.warp(VIEW + DAY + WEEK);
        _wrong(id, Span.Status.Disputed, Span.Status.Locked);
        span.timeout(id);
    }

    function test_Timeout_ClearsPendingProposals() public {
        uint256 id = _disputed();
        vm.prank(host);
        span.proposeSplit(id, 10e6);
        vm.warp(VIEW + DAY + WEEK);
        span.timeout(id);
        assertEq(span.credits(host), AMT);
        assertEq(span.credits(guest), AMT);
    }

    // ---------- unknown id ----------
    function test_UnknownIdReverts() public {
        uint256[2] memory ids = [uint256(0), 999];
        for (uint256 i; i < 2; i++) {
            uint256 id = ids[i];
            bytes memory err = abi.encodeWithSelector(Span.UnknownDeal.selector, id);
            vm.expectRevert(err);
            span.cancel(id);
            vm.expectRevert(err);
            span.pay(id);
            vm.expectRevert(err);
            span.guestWalkAway(id);
            vm.expectRevert(err);
            span.hostWalkAway(id);
            vm.expectRevert(err);
            span.confirm(id);
            vm.expectRevert(err);
            span.release(id);
            vm.expectRevert(err);
            span.dispute(id);
            vm.expectRevert(err);
            span.proposeSplit(id, 0);
            vm.expectRevert(err);
            span.timeout(id);
            vm.expectRevert(err);
            span.getDeal(id);
        }
    }

    // ---------- withdraw ----------
    function test_Withdraw_TransfersFullCreditAndZeroes() public {
        uint256 id = _lock();
        vm.prank(guest);
        span.confirm(id);
        uint256 before = token.balanceOf(host);
        vm.expectEmit(true, false, false, true, address(span));
        emit Span.Withdrawn(host, 2 * AMT);
        vm.prank(host);
        span.withdraw();
        assertEq(token.balanceOf(host), before + 2 * AMT);
        assertEq(span.credits(host), 0);
        assertEq(token.balanceOf(address(span)), 0);
        vm.prank(host);
        vm.expectRevert(Span.NoCredit.selector);
        span.withdraw();
    }

    function test_Withdraw_NoCreditReverts() public {
        vm.prank(other);
        vm.expectRevert(Span.NoCredit.selector);
        span.withdraw();
    }

    function test_Withdraw_AccumulatesAcrossDeals() public {
        uint256 a = _open();
        uint256 b = _open();
        vm.startPrank(host);
        span.cancel(a);
        span.cancel(b);
        span.withdraw();
        vm.stopPrank();
        assertEq(span.credits(host), 0);
        assertEq(token.balanceOf(address(span)), 0);
    }

    // ---------- blocklisted party ----------
    function test_Blocklist_BlockedHostDoesNotTrapGuest() public {
        uint256 id = _disputed();
        token.setBlocked(host, true);
        vm.warp(VIEW + DAY + WEEK);
        span.timeout(id); // closing never transfers, so a blocked host cannot stop it
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));

        uint256 gBefore = token.balanceOf(guest);
        vm.prank(guest);
        span.withdraw();
        assertEq(token.balanceOf(guest), gBefore + AMT);
        assertEq(span.credits(guest), 0);

        // host's own withdraw reverts and credit is preserved
        vm.prank(host);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, host));
        span.withdraw();
        assertEq(span.credits(host), AMT);

        // once unblocked, host recovers it
        token.setBlocked(host, false);
        vm.prank(host);
        span.withdraw();
        assertEq(span.credits(host), 0);
        assertEq(token.balanceOf(address(span)), 0);
    }

    function test_Blocklist_BlockedGuestSettlementStillCloses() public {
        uint256 id = _disputed();
        token.setBlocked(guest, true);
        vm.prank(host);
        span.proposeSplit(id, 40e6);
        vm.prank(guest);
        span.proposeSplit(id, 40e6);
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        vm.prank(host);
        span.withdraw();
        assertEq(span.credits(host), 0);
        vm.prank(guest);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, guest));
        span.withdraw();
        assertEq(span.credits(guest), 40e6);
        assertEq(token.balanceOf(address(span)), 40e6);
    }

    // ---------- fuzz ----------
    function testFuzz_AgreedSplitConservesFunds(uint128 amount, uint128 toGuest) public {
        amount = uint128(bound(amount, 1, type(uint128).max / 4));
        toGuest = uint128(bound(toGuest, 0, amount));
        vm.prank(host);
        uint256 id = span.open(amount, VIEW, address(0), REF);
        vm.prank(guest);
        span.pay(id);
        vm.warp(VIEW);
        vm.prank(guest);
        span.dispute(id);
        vm.prank(host);
        span.proposeSplit(id, toGuest);
        vm.prank(guest);
        span.proposeSplit(id, toGuest);

        assertEq(span.credits(guest), toGuest);
        assertEq(span.credits(host), 2 * uint256(amount) - toGuest);
        assertEq(span.credits(host) + span.credits(guest), 2 * uint256(amount));
        assertEq(token.balanceOf(address(span)), span.credits(host) + span.credits(guest));
        assertEq(token.balanceOf(address(span)), 2 * uint256(amount));
    }

    /// @dev path: 0 cancel, 1 guestWalk, 2 hostWalk, 3 confirm, 4 release, 5 settle, 6 timeout
    function testFuzz_EveryClosingPathConservesFunds(uint128 amount, uint8 path, uint128 toGuest) public {
        amount = uint128(bound(amount, 1, type(uint128).max / 4));
        path = uint8(bound(path, 0, 6));
        toGuest = uint128(bound(toGuest, 0, amount));

        vm.prank(host);
        uint256 id = span.open(amount, VIEW, address(0), REF);
        uint256 expected = 2 * uint256(amount);
        if (path == 0) {
            vm.prank(host);
            span.cancel(id);
            expected = amount;
        } else {
            vm.prank(guest);
            span.pay(id);
            if (path == 1) {
                vm.prank(guest);
                span.guestWalkAway(id);
            } else if (path == 2) {
                vm.prank(host);
                span.hostWalkAway(id);
            } else if (path == 3) {
                vm.prank(guest);
                span.confirm(id);
            } else if (path == 4) {
                vm.warp(VIEW + DAY);
                span.release(id);
            } else {
                vm.warp(VIEW);
                vm.prank(guest);
                span.dispute(id);
                if (path == 5) {
                    vm.prank(guest);
                    span.proposeSplit(id, toGuest);
                    vm.prank(host);
                    span.proposeSplit(id, toGuest);
                } else {
                    vm.warp(VIEW + DAY + WEEK);
                    span.timeout(id);
                }
            }
        }
        assertEq(uint8(_status(id)), uint8(Span.Status.Closed));
        uint256 total = span.credits(host) + span.credits(guest);
        assertEq(total, expected);
        assertEq(token.balanceOf(address(span)), total);
    }
}

/// @dev Drives random, bounded sequences of Span actions among three actors.
contract SpanHandler is Test {
    Span public span;
    MockUSDC public token;
    address[3] public actors;

    constructor(Span span_, MockUSDC token_) {
        span = span_;
        token = token_;
        actors = [address(0xA1), address(0xB2), address(0xC3)];
        for (uint256 i; i < 3; i++) {
            token.mint(actors[i], 1e30);
            vm.prank(actors[i]);
            token.approve(address(span), type(uint256).max);
        }
    }

    function _actor(uint256 s) internal view returns (address) { return actors[s % 3]; }

    function _id(uint256 s) internal view returns (uint256) {
        uint256 n = span.nextId();
        return n == 1 ? 0 : bound(s, 1, n - 1);
    }

    function warp(uint256 dt) external { vm.warp(block.timestamp + bound(dt, 0, 3 days)); }

    function open(uint256 s, uint128 amt, uint256 delay) external {
        amt = uint128(bound(amt, 1, 1e12));
        vm.prank(_actor(s));
        span.open(amt, uint64(block.timestamp + bound(delay, 1, 2 days)), address(0), bytes32(0));
    }

    function pay(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.pay(id) {} catch {}
    }

    function cancel(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.cancel(id) {} catch {}
    }

    function guestWalkAway(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.guestWalkAway(id) {} catch {}
    }

    function hostWalkAway(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.hostWalkAway(id) {} catch {}
    }

    function confirm(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.confirm(id) {} catch {}
    }

    function release(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.release(id) {} catch {}
    }

    function dispute(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.dispute(id) {} catch {}
    }

    function propose(uint256 s, uint256 i, uint128 toGuest) external {
        uint256 id = _id(i);
        if (id == 0) return;
        toGuest = uint128(bound(toGuest, 0, span.getDeal(id).amount));
        vm.prank(_actor(s));
        try span.proposeSplit(id, toGuest) {} catch {}
    }

    function timeout(uint256 s, uint256 i) external {
        uint256 id = _id(i);
        vm.prank(_actor(s));
        try span.timeout(id) {} catch {}
    }

    function withdraw(uint256 s) external {
        vm.prank(_actor(s));
        try span.withdraw() {} catch {}
    }

    /// @dev Tokens the contract must still hold: unclaimed credits + escrow of live deals.
    function expectedBalance() external view returns (uint256 total) {
        for (uint256 i; i < 3; i++) total += span.credits(actors[i]);
        for (uint256 id = 1; id < span.nextId(); id++) {
            Span.Deal memory d = span.getDeal(id);
            if (d.status == Span.Status.Open) total += d.amount;
            else if (d.status != Span.Status.Closed) total += 2 * uint256(d.amount);
        }
    }
}

contract SpanInvariantTest is Test {
    Span internal span;
    MockUSDC internal token;
    SpanHandler internal handler;

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockUSDC();
        span = new Span(IERC20(address(token)));
        handler = new SpanHandler(span, token);
        targetContract(address(handler));
    }

    /// PROPERTY: the contract's token balance always equals unclaimed credits plus live escrow.
    function invariant_BalanceEqualsCreditsPlusEscrow() public view {
        assertEq(token.balanceOf(address(span)), handler.expectedBalance());
    }
}
