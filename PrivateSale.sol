// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PrivateSale {
  using SafeERC20 for IERC20;

  address private owner;
  mapping(address => bool) private whitelist;
  mapping(address => bool) private participants;
  mapping(address => uint) timeBought;

  struct SaleOptions {
    uint maxSupply;
    uint price;
    uint fee;
    uint startTime;
    uint endTime;
    uint hardGoal;
    uint softGoal;
    uint minPerBuy;
    uint maxPerBuy;
  }

  SaleOptions setting;
  IERC20 token;
  uint currentEth;
  uint currentSupply;
  //Current state of the sale {1: Initialized, 2: Active, 3: Canceled, 4: Finalized}.
  uint saleState;

  constructor(SaleOptions memory saleOptions, address _token) {
    owner = msg.sender;
    setting = saleOptions;
    currentSupply = saleOptions.maxSupply;
    token = IERC20(_token);
  }

  modifier onlyOwner() {
    require(msg.sender == owner,"you no boss");
    _;
  }

  function buy() external payable {}

  function claim() external {}
}