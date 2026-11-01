import { parseAbi } from 'viem'

export const spanAbi = parseAbi([
  'function nextId() view returns (uint256)',
  'function credits(address) view returns (uint256)',
  'function stats(address) view returns (uint32 completed, uint32 walkedAway, uint32 disputesRaised, uint32 disputesReceived)',
  'function getDeal(uint256 id) view returns ((address host, address guest, address allowedGuest, uint128 amount, uint64 viewingAt, uint8 status, bytes32 ref))',
  'function open(uint128 amount, uint64 viewingAt, address allowedGuest, bytes32 ref) returns (uint256 id)',
  'function cancel(uint256 id)',
  'function pay(uint256 id)',
  'function guestWalkAway(uint256 id)',
  'function hostWalkAway(uint256 id)',
  'function confirm(uint256 id)',
  'function release(uint256 id)',
  'function dispute(uint256 id)',
  'function proposeSplit(uint256 id, uint128 toGuest)',
  'function timeout(uint256 id)',
  'function withdraw()',
  'event Opened(uint256 indexed id, address indexed host, address indexed allowedGuest, uint128 amount, uint64 viewingAt, bytes32 ref)',
  'event Paid(uint256 indexed id, address indexed guest)',
  'event SplitProposed(uint256 indexed id, address indexed who, uint128 toGuest)',
])

export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
])

export const STATUS = ['Waiting for the guest', 'Deposit locked', 'Disputed', 'Closed'] as const
