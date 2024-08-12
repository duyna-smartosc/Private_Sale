// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interface/errorInterface.sol";
import "./utils/commonInterface.sol";

contract PrivateSale is IError, ICommon{
  using SafeERC20 for IERC20;

  // store the deposit amount in sale with name for each user
  struct SaleDeposit {
    string name;
    uint256 deposit;
  }

  // Store all the info of a sale
  struct Sale {
    bytes name;
    /**
      * Store properties in when sale launches
      * saleProperties[0] is currentSupply
      * saleProperties[1] is maxSupply
      * saleProperties[2] is softGoal
      * saleProperties[3] is minPerBuy
      * saleProperties[4] is maxPerBuy
      * saleProperties[5] is currentWei
      * saleProperties[6] is startTime
      * saleProperties[7] is endTime
      */
    uint256[8] saleProperties;
    /**
      * Store properties when user contacts system
      * saleFinances[0] is totalTimeBought
      * saleFinances[1] is joinPercent
      * saleFinances[2] is vipPercent
      */
    uint8[3] saleFinances;
    //Current state of the sale {0: Initialized, 1: Active, 2: Canceled, 3: Finalized}.
    SaleState saleState;
    IERC20 token;
  }

  /**
   * @dev Address of the owner of the contract
   */
  address private owner;

  /**
   * @dev Mapping to check if an address belongs to whitelist
   */
  mapping(address => bool) private whitelist;

  /**
   * @dev Mapping to check if an address is a participants
   */
  mapping(address => bool) private participants;

  /**
   * @dev Mapping to check the deposit of an user in a specific sale
   */
  mapping(address => mapping (uint8 => SaleDeposit)) private userDeposit;

  /**
   * @dev mapping to get sale id from sale name
   */
  mapping(bytes => uint8) private saleId;

  /**
   * @dev Array to store sales
   */
  Sale[] private sales;

  /**
   * @dev The deposit amount each user needed to be whitelisted
   */
  uint8 private depositAmountThresh = 50;

  /**
   * @dev The deposit time each user needed to be whitelisted
   */
  uint8 private depositTimeThresh = 3;

  /**
   * @dev decimals of the token used in sale
   */
  uint256 private decimals = 18;

  /**
   * @dev Event emitted when a sale is created
   * @param sale The Sale owner create
   */
  event CreateSale (Sale sale);

  /** 
   * @dev Event emitted when an user buy in sale
   * @param name The name of a sale user buy in
   * @param amount The amount of wei used for the purchase
   * @param currentSupply The supply left in sale after user buy
   */ 
  event Buy(bytes indexed name, uint256 amount, uint256 currentSupply);

  /** 
   * @dev Event emitted when the owner claim wei from a finalized sale
   * @param name The name of a sale owner claim from
   * @param amount The amount of wei the owner got from the sale
   */ 
  event ClaimTokenFromFinalizedSale(bytes indexed name, uint256 amount);

  /** 
   * @dev Event emitted when user reclaim wei from a canceled sale
   * @param name The name of a sale user reclaim from
   * @param amount The amount of wei the user reclaim from the sale
   */ 
  event ReclaimWeiFromCanceledSale(bytes indexed name, uint256 amount);

  /** 
   * @dev Modifier to ensure only owner can use this function
   */ 
  modifier onlyOwner() {
    if(msg.sender != owner) revert NotOwner();
    _;
  }

  /** 
   * @dev Modifier to check if the user is a participant
   */
  modifier isParticipant() {
    if(participants[msg.sender] != true) revert NotParticipant(); 
    _;
  }

  /** 
   * @dev set the owner to be the address who create this contract
   */
  constructor() {
    owner = msg.sender;
  }

  /** 
   * @dev register an user as a participant
   * @param user The address of the user being register as a participan
   */ 
  function register(address user) public onlyOwner {
    if(participants[user] == true) revert AlreadyParticipant(); 
    participants[user] = true;
  }

  /** 
   * @dev register an user for whitelist
   * @param user The address of the user being register for whitelist
   */ 
  function registerVip(address user) public onlyOwner {
    if(participants[user] != true) revert NotParticipant();
    if(totalDeposit(user) < depositAmountThresh || totalTime(user) < depositTimeThresh) {
      revert VipConditionUnsastified();
    }
    if(whitelist[user] == true) {
      revert AlreadyVip();
    }
    whitelist[user] = true;
  }
  
  /** 
   * @dev change the condition for being in whitelist
   * @param _depositAmountThresh The new deposit amount threshold for whitelist
   * @param _depositTimeThresh The new deposit time threshold for whitelist
   */ 
  function changeVipCondition(uint8 _depositAmountThresh, uint8 _depositTimeThresh) public onlyOwner {
    if(_depositAmountThresh < 0 || _depositTimeThresh < 0) {
      revert InputInvalid();
    }
    depositAmountThresh = _depositAmountThresh;
    depositTimeThresh = _depositTimeThresh;
  }

  /** 
   * @dev Create a new sale
   * @param _sale The information of the new sale
   * @param token The address of the token being sold
   */ 
  function createSale(Sale memory _sale, address token) public onlyOwner {
    sales.push(_sale);
    saleId[_sale.name] = uint8(sales.length-1);
    Sale storage sale = sales[sales.length-1];
    sale.saleProperties[0] = sale.saleProperties[1];
    sale.token = IERC20(token);

    emit CreateSale(sale);
  }

  /** 
   * @dev Start a sale
   * @param name The name of the sale being started
   * @param duration The duration of the sale
   */ 
  function startSale(bytes memory name, uint256 duration) public onlyOwner {
    Sale storage sale = sales[saleId[name]];
    if(sale.saleProperties[1] == 0) revert SaleNotExist();
    if(sale.saleState != SaleState.INITIALIZED) revert SaleNotInitialized();
    if(duration <= 0) revert InputInvalid();
    
    sale.saleProperties[6] = uint136(block.timestamp);
    sale.saleProperties[7] = uint136(sale.saleProperties[6] + duration);
    
    sale.saleState = SaleState.ACTIVE;
  }

  /** 
   * @dev End a sale
   * If the softcap condition of the sale is sastified, the sale will be finalized
   * else the sale will be canceled
   * @param name The name of the sale being ended
   */
  function endSale(bytes memory name) public onlyOwner {
    Sale storage sale = sales[saleId[name]];
    if(sale.saleState != SaleState.ACTIVE) revert SaleNotActive();
    if(block.timestamp <= sale.saleProperties[7]) revert SaleNotOver();

    if(sale.saleProperties[2] > sale.saleProperties[5]) {
      sale.saleState = SaleState.CANCELED;
    } 
    if(sale.saleProperties[2] <= sale.saleProperties[5]) {
      sale.saleState = SaleState.FINALIZED;
    }
  }

  /** 
   * @dev Calculate the total deposit an user had made in all the sale the user participate in
   * @param user The address of the user whose total deposit being checked
   * @return {uint256} The total deposit of the user
   */
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

  /** 
   * @dev Calculate the total time an user had deposit in all the sale the user participate in
   * @param user The address of the user whose total deposit being checked
   * @return {uint256} The total deposit time of the user
   */
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

  /** 
   * @dev Buy token in a sale
   * The function only let user deposit the amount of wei they used to buy
   * The user can only claim token if the sale is finalized
   * @param name The name of the sale user want to buy from
   */
  function buy(bytes memory name) external payable isParticipant {
    uint8 id = saleId[name];
    Sale storage sale = sales[saleId[name]];

    if(sale.saleState != SaleState.ACTIVE) revert SaleNotActive();
    if(block.timestamp > sale.saleProperties[7]) {
      revert SaleIsOver();
    }
    if(msg.value < sale.saleProperties[3] || msg.value > sale.saleProperties[4]) {
      revert InputInvalid();
    }
    if(sale.saleProperties[1] - sale.saleProperties[5] * sale.saleFinances[2] - msg.value < 0) {
      revert InsufficientSupplyInSale();
    }
    unchecked {
      userDeposit[msg.sender][id].deposit += msg.value;
      sale.saleProperties[5] += msg.value;
      sale.saleFinances[0]++;

      if (whitelist[msg.sender]) {
        sale.saleProperties[0] -= userDeposit[msg.sender][id].deposit * sale.saleFinances[2];
      } else {
        sale.saleProperties[0] -= userDeposit[msg.sender][id].deposit * sale.saleFinances[1];
      }
    }
    
    emit Buy(name, msg.value, sale.saleProperties[0]);
  }

  /** 
   * @dev Let user claim in a sale
   * If the sale is canceled, let user reclaim the amount of wei they have deposited
   * If the sale is finalized, let user claim the amount of token according to the amount deposited and the fee percent
   * @param name The name of the sale user want to claim from
   */
  function claim(bytes memory name) external isParticipant {
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
          amount = userDeposit[msg.sender][saleId[name]].deposit * sale.saleFinances[2];
      } else {
          amount = userDeposit[msg.sender][saleId[name]].deposit * sale.saleFinances[1];
      } 
      sale.token.safeTransferFrom(owner, msg.sender, amount);
      emit ClaimTokenFromFinalizedSale(name, amount);
    }
  }

  /** 
   * @dev Let the owner withdraw the amount of wei got from a finalized sale
   * @param name The name of the sale owner want to withdraw from
   */
  function withdraw(bytes memory name) public onlyOwner {
    Sale memory sale = sales[saleId[name]];
    if(sale.saleState != SaleState.FINALIZED) {
      revert SaleNotFinalized();
    }
    payable (owner).transfer(sale.saleProperties[5]);
  }

  /** 
   * @dev Get the current supply of a sale
   * @param name The name of the sale being checked
   * @return {uint256} The current supply of a sale
   */
  function getCurrentSuppy(bytes memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].saleProperties[0];
  }

  /** 
   * @dev Get the current wei of a sale
   * @param name The name of the sale being checked
   * @return {uint256} The current wei of a sale
   */
  function getCurrentWei(bytes memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].saleProperties[5];
  }

  /** 
   * @dev Get the total time a sale has been bought by users
   * @param name The name of the sale being checked
   * @return {uint256} The the total time a sale has been bought by users
   */
  function gettotalTimeBought(bytes memory name) public view returns(uint256) {
      uint8 id = saleId[name];
      return sales[id].saleFinances[0];
  }

  /** 
   * @dev Check if an user is in whitelist
   * This function is for testing purpose only and can only be called by owner address
   * @param user Address of the user being checked
   * @return {bool} Whether the user is in whitelist or not
   */
  function checkWhiteList(address user) public view onlyOwner returns(bool) {
    return whitelist[user];
  }

  /** 
   * @dev Check if an user is a participants
   * This function is for testing purpose only and can only be called by owner address
   * @param user Address of the user being checked
   * @return {bool} Whether the user is a participant or not
   */
  function checkParticipants(address user) public view onlyOwner returns(bool) {
    return participants[user];
  }

  /** 
   * @dev Check the deposit of an user
   * This function is for testing purpose only and can only be called by owner address
   * @param user Address of the user being checked
   * @param id the id of the sale being checked
   * @return {saleDepost} the sale name and deposit that user has made
   */
  function checkUserDeposit(address user, uint8 id) public view onlyOwner returns(SaleDeposit memory) {
    return userDeposit[user][id];
  }

  /** 
   * @dev Check the id of a sale
   * This function is for testing purpose only and can only be called by owner address
   * @param name the name of the sale being checked
   * @return {uint8} the id of the sale
   */
  function checksaleId(bytes memory name) public view onlyOwner returns(uint8) {
    return saleId[name];
  }

  /** 
   * @dev Get info of a sale
   * This function is for testing purpose only and can only be called by owner address
   * @param id the id of the sale being checked
   * @return {uint8} the information of the sale
   */
  function getSale(uint8 id) public view onlyOwner returns(Sale memory) {
    return sales[id];
  }

  /** 
   * @dev Get the deposit amouth threshold
   * This function is for testing purpose only and can only be called by owner address
   * @return {uint8} the current deposit amount threshold
   */
  function getDepositAmountThresh() public view onlyOwner returns (uint8) {
    return depositAmountThresh;
  }

  /** 
   * @dev Get the deposit time threshold
   * This function is for testing purpose only and can only be called by owner address
   * @return {uint8} the current deposit time threshold
   */
  function getDepositTimeThresh() public view onlyOwner returns (uint8) {
    return depositTimeThresh;
  }
}