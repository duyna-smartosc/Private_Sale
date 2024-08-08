// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interface/errorInterface.sol";
import "./utils/commonInterface.sol";

contract PrivateSale {
  using SafeERC20 for IERC20;

  struct SaleDeposit {
    string name;
    uint256 deposit;
  }

  struct Sale{
    string name;
    uint256 currentSupply;
    uint256 maxSupply;
    uint256 softGoal;
    uint256 minPerBuy;
    uint256 maxPerBuy;
    uint256 currentWei;
    uint136 startTime;
    uint136 endTime;
    uint8 totalTimeBought;
    uint8 joinPercent;
    uint8 vipPercent;
    //Current state of the sale {0: Initialized, 1: Active, 2: Canceled, 3: Finalized}.
    SaleState saleState;
    IERC20 token;
  }

  address private owner;

  mapping(address => bool) private whitelist;

  mapping(address => bool) private participants;

  mapping(address => mapping (uint8 => SaleDeposit)) private userDeposit;

  mapping(string => uint8) private saleId;

  Sale[] private sales;

  uint8 private depositAmountThresh = 50;
  uint8 private depositTimeThresh = 3;
  uint256 private decimals = 18;

  event CreateSale (Sale sale);

  event Buy(string name, uint256 amount, uint256 currentSupply);

  event ClaimTokenFromFinalizedSale(string name, uint256 amount);

  event ReclaimWeiFromCanceledSale(string name, uint256 amount);

  modifier onlyOwner() {
    if(msg.sender != owner) revert NotOwner();
    _;
  }

  modifier isParticipant() {
    if(participants[msg.sender] != true) revert NotParticipant(); 
    _;
  }

  constructor() {
    owner = msg.sender;
  }

  function register(address user) public onlyOwner {
    if(participants[user] = true) revert AlreadyParticipant(); 
    participants[user] = true;
  }

  function registerVip(address user) public onlyOwner {
    if(participants[user] = true) revert NotParticipant();
    if(totalDeposit(user) < depositAmountThresh || totalTime(user) < depositTimeThresh) {
      revert VipConditionUnsastified();
    }
    whitelist[user] = true;
  }

  function changeVipCondition(uint8 _depositAmountThresh, uint8 _depositTimeThresh) public onlyOwner {
    if(_depositAmountThresh < 0 || _depositTimeThresh < 0) {
      revert InputInvalid();
    }
    depositAmountThresh = _depositAmountThresh;
    depositTimeThresh = _depositTimeThresh;
  }

  function createSale(Sale memory sale) public onlyOwner {
    sales.push(sale);
    saleId[sale.name] = uint8(sales.length-1);

    emit CreateSale(sale);
  }

  function startSale(string memory name, uint256 duration) public onlyOwner {
    Sale storage sale = sales[saleId[name]];
    if(sale.maxSupply == 0) revert SaleNotExist();
    if(sale.saleState != SaleState.INITIALIZED) revert SaleNotInitialized();
    
    sale.startTime = uint136(block.timestamp);
    sale.endTime = uint136(sale.startTime + duration);
    
    sale.saleState = SaleState.ACTIVE;
  }

  function endSale(string memory name) public onlyOwner {
    Sale storage sale = sales[saleId[name]];
    if(sale.saleState != SaleState.ACTIVE) revert SaleNotActive();
    if(block.timestamp <= sale.endTime) revert SaleNotOver();

    if(sale.softGoal > sale.currentWei) {
      sale.saleState = SaleState.CANCELED;
    } 
    if(sale.softGoal <= sale.currentWei) {
      sale.saleState = SaleState.FINALIZED;
    }
  }

  function totalDeposit(address user) private view returns (uint256) {
    uint256 total = 0;
    unchecked {
      for (uint8 i = 0; i < sales.length;) {
        total += userDeposit[user][i].deposit;
        ++i;
      }  
    }
    return total;
  }

  function totalTime(address user) private view returns (uint256) {
    uint256 total = 0;
    unchecked {
      for (uint8 i = 0; i < sales.length;) {
        if(userDeposit[user][i].deposit != 0) total++;
        ++i;
      }
    }
    return total;
  }

  function buy(string memory name) external payable isParticipant {
    uint8 id = saleId[name];
    Sale storage sale = sales[saleId[name]];

    if(sale.saleState != SaleState.ACTIVE) revert SaleNotActive();
    if(block.timestamp > sale.endTime) {
      revert SaleIsOver();
    }
    if(msg.value < sale.minPerBuy || msg.value > sale.maxPerBuy) {
      revert InputInvalid();
    }
    if(sale.maxSupply - sale.currentWei * sale.vipPercent - msg.value < 0) {
      revert InsufficientSupplyInSale();
    }

    userDeposit[msg.sender][id].deposit += msg.value;
    sale.currentWei += msg.value;
    sale.totalTimeBought++;

    if (whitelist[msg.sender]) {
      sale.currentSupply -= userDeposit[msg.sender][id].deposit * sale.vipPercent;
    } else {
      sale.currentSupply -= userDeposit[msg.sender][id].deposit * sale.joinPercent;
    }

    emit Buy(name, msg.value, sale.currentSupply);
  }

  function claim(string memory name) external isParticipant {
    Sale memory sale = sales[saleId[name]];
    if(sale.saleState != SaleState.CANCELED && sale.saleState != SaleState.FINALIZED) {
      revert SaleNotOver();
    }

    uint256 amount = 0;
    if(sale.saleState == SaleState.CANCELED) {
      amount = userDeposit[msg.sender][saleId[name]].deposit;
      payable (msg.sender).transfer(amount);
      emit ReclaimWeiFromCanceledSale(name, amount);
    } 
    if(sale.saleState == SaleState.FINALIZED) {
      if (whitelist[msg.sender]) {
          amount = userDeposit[msg.sender][saleId[name]].deposit * sale.vipPercent;
      } else {
          amount = userDeposit[msg.sender][saleId[name]].deposit * sale.joinPercent;
      } 
      sale.token.safeTransferFrom(owner, msg.sender, amount);
      emit ClaimTokenFromFinalizedSale(name, amount);
    }
  }

  function withdraw(string memory name) public onlyOwner {
    Sale memory sale = sales[saleId[name]];
    if(sale.saleState != SaleState.FINALIZED) {
      revert SaleNotFinalized();
    }
    payable (owner).transfer(sale.currentWei);
  }

  function getCurrentSuppy(string memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].currentSupply;
  }

  function getCurrentWei(string memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].currentWei;
  }

  function gettotalTimeBought(string memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].totalTimeBought;
  }

}