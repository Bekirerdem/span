// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Two-sided USDC holding deposits, with no administrator or arbiter.
/// @dev Amounts are raw USDC units (6 decimals). All payouts are independent pull credits.
contract Span is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { Open, Locked, Disputed, Closed }

    struct Deal {
        address host;
        address guest;
        address allowedGuest;
        uint128 amount;
        uint64 viewingAt;
        Status status;
        bytes32 ref;
    }

    struct Stats {
        uint32 completed;
        uint32 walkedAway;
        uint32 disputesRaised;
        uint32 disputesReceived;
    }

    IERC20 public immutable usdc;
    uint256 public nextId = 1;
    mapping(uint256 => Deal) private _deals;
    mapping(address => uint256) public credits;
    mapping(address => Stats) public stats;

    // Host proposal at index 0, guest proposal at index 1. Encoded as toGuest + 1.
    // uint256 accommodates type(uint128).max + 1 without overflow.
    mapping(uint256 => uint256[2]) private _proposals;

    error InvalidToken();
    error InvalidAmount();
    error InvalidViewingTime();
    error UnknownDeal(uint256 id);
    error WrongStatus(uint256 id, Status expected, Status actual);
    error HostOnly();
    error GuestOnly();
    error PartiesOnly();
    error HostCannotPay();
    error GuestNotAllowed();
    error ViewingAlreadyStarted();
    error DisputeWindowNotOpen();
    error DisputeWindowNotClosed();
    error TimeoutNotReached();
    error InvalidSplit();
    error NoCredit();

    event Opened(
        uint256 indexed id,
        address indexed host,
        address indexed allowedGuest,
        uint128 amount,
        uint64 viewingAt,
        bytes32 ref
    );
    event Cancelled(uint256 indexed id);
    event Paid(uint256 indexed id, address indexed guest);
    event WalkedAway(uint256 indexed id, address indexed who, address indexed beneficiary);
    event Confirmed(uint256 indexed id);
    event Released(uint256 indexed id);
    event Disputed(uint256 indexed id);
    event SplitProposed(uint256 indexed id, address indexed who, uint128 toGuest);
    event Settled(uint256 indexed id, uint256 toGuest, uint256 toHost);
    event TimedOut(uint256 indexed id);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert InvalidToken();
        usdc = usdc_;
    }

    /// @notice Lock the host's bond. A zero allowedGuest permits any non-host guest.
    function open(uint128 amount, uint64 viewingAt, address allowedGuest, bytes32 ref)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (amount == 0) revert InvalidAmount();
        if (uint256(viewingAt) <= block.timestamp) revert InvalidViewingTime();

        id = nextId++;
        _deals[id] = Deal({
            host: msg.sender,
            guest: address(0),
            allowedGuest: allowedGuest,
            amount: amount,
            viewingAt: viewingAt,
            status: Status.Open,
            ref: ref
        });
        emit Opened(id, msg.sender, allowedGuest, amount, viewingAt, ref);
        usdc.safeTransferFrom(msg.sender, address(this), uint256(amount));
    }

    function cancel(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Open);
        if (msg.sender != deal.host) revert HostOnly();

        deal.status = Status.Closed;
        credits[deal.host] += uint256(deal.amount);
        emit Cancelled(id);
    }

    function pay(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Open);
        if (msg.sender == deal.host) revert HostCannotPay();
        if (deal.allowedGuest != address(0) && msg.sender != deal.allowedGuest) {
            revert GuestNotAllowed();
        }
        if (block.timestamp >= uint256(deal.viewingAt)) revert ViewingAlreadyStarted();

        deal.guest = msg.sender;
        deal.status = Status.Locked;
        emit Paid(id, msg.sender);
        usdc.safeTransferFrom(msg.sender, address(this), uint256(deal.amount));
    }

    function guestWalkAway(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Locked);
        if (msg.sender != deal.guest) revert GuestOnly();
        if (block.timestamp >= uint256(deal.viewingAt)) revert ViewingAlreadyStarted();

        deal.status = Status.Closed;
        credits[deal.host] += uint256(deal.amount) * 2;
        stats[deal.guest].walkedAway++;
        emit WalkedAway(id, deal.guest, deal.host);
    }

    function hostWalkAway(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Locked);
        if (msg.sender != deal.host) revert HostOnly();

        deal.status = Status.Closed;
        credits[deal.guest] += uint256(deal.amount) * 2;
        stats[deal.host].walkedAway++;
        emit WalkedAway(id, deal.host, deal.guest);
    }

    function confirm(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Locked);
        if (msg.sender != deal.guest) revert GuestOnly();

        _complete(deal);
        emit Confirmed(id);
    }

    function release(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Locked);
        if (block.timestamp < uint256(deal.viewingAt) + 24 hours) {
            revert DisputeWindowNotClosed();
        }

        _complete(deal);
        emit Released(id);
    }

    function dispute(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Locked);
        if (msg.sender != deal.guest) revert GuestOnly();
        uint256 viewingAt = uint256(deal.viewingAt);
        if (block.timestamp < viewingAt || block.timestamp >= viewingAt + 24 hours) {
            revert DisputeWindowNotOpen();
        }

        deal.status = Status.Disputed;
        stats[deal.guest].disputesRaised++;
        stats[deal.host].disputesReceived++;
        emit Disputed(id);
    }

    /// @notice Split only the deposit; the host always recovers its bond on agreement.
    function proposeSplit(uint256 id, uint128 toGuest) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Disputed);
        uint256 side = 0; // 0 = host, 1 = guest
        if (msg.sender == deal.guest) {
            side = 1;
        } else if (msg.sender != deal.host) {
            revert PartiesOnly();
        }
        if (toGuest > deal.amount) revert InvalidSplit();

        uint256 encoded = uint256(toGuest) + 1;
        _proposals[id][side] = encoded;
        emit SplitProposed(id, msg.sender, toGuest);

        if (_proposals[id][1 - side] == encoded) {
            uint256 guestCredit = uint256(toGuest);
            uint256 hostCredit = uint256(deal.amount) * 2 - guestCredit;
            deal.status = Status.Closed;
            credits[deal.guest] += guestCredit;
            credits[deal.host] += hostCredit;
            delete _proposals[id];
            emit Settled(id, guestCredit, hostCredit);
        }
    }

    function timeout(uint256 id) external nonReentrant {
        Deal storage deal = _dealWithStatus(id, Status.Disputed);
        if (block.timestamp < uint256(deal.viewingAt) + 24 hours + 7 days) {
            revert TimeoutNotReached();
        }

        deal.status = Status.Closed;
        credits[deal.guest] += uint256(deal.amount);
        credits[deal.host] += uint256(deal.amount);
        delete _proposals[id];
        emit TimedOut(id);
    }

    /// @dev A failed token transfer restores only this caller's credit on revert.
    ///      Closing a deal never transfers tokens, so a blocked party cannot stop
    ///      the other party from receiving and withdrawing its own credit.
    function withdraw() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NoCredit();

        credits[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        usdc.safeTransfer(msg.sender, amount);
    }

    function getDeal(uint256 id) external view returns (Deal memory) {
        return _deal(id);
    }

    function _deal(uint256 id) private view returns (Deal storage deal) {
        deal = _deals[id];
        if (deal.host == address(0)) revert UnknownDeal(id);
    }

    function _dealWithStatus(uint256 id, Status expected) private view returns (Deal storage deal) {
        deal = _deal(id);
        if (deal.status != expected) revert WrongStatus(id, expected, deal.status);
    }

    function _complete(Deal storage deal) private {
        deal.status = Status.Closed;
        credits[deal.host] += uint256(deal.amount) * 2;
        stats[deal.host].completed++;
        stats[deal.guest].completed++;
    }
}
