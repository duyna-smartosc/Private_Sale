// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20Token is ERC20("MyLovelyToken", "MLT"){
  constructor() {
    _mint(msg.sender, 100000000000);
  }
}