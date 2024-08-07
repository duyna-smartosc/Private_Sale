// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PrivateSale {
    using SafeERC20 for IERC20;

    address private owner;
    mapping(address => bool) private whitelist;
    mapping(address => bool) private participants;
    mapping(address => mapping (uint8 => SaleDeposit)) userDeposit;
    Sale[] sales;
    mapping(string => uint8) saleId;


    uint8 depositAmountThresh = 50;
    uint8 depositTimeThresh = 3;
    uint256 decimals = 10**18;

    struct SaleDeposit {
        string name;
        uint256 deposit;
    }

  struct Sale{
    string name;
    uint256 currentSupply;
    uint256 maxSupply;
    uint256 startTime;
    uint256 endTime;
    uint256 softGoal;
    uint256 minPerBuy;
    uint256 maxPerBuy;
    uint256 currentWei;
    //Current state of the sale {0: Initialized, 1: Active, 2: Canceled, 3: Finalized}.
    uint8 saleState;
    uint8 totalBought;
    uint8 joinPercent;
    uint8 vipPercent;
    IERC20 token;
  }

  constructor() {
    owner = msg.sender;
  }

  modifier onlyOwner() {
    require(msg.sender == owner,"you no boss");
    _;
  }

  modifier depositCondition(uint8 id) {
        require(sales[id].saleState == 1, "Sale is not Active");
        require(msg.value >= sales[id].minPerBuy && msg.value <= sales[id].maxPerBuy , "Amount invalid");
        require(participants[msg.sender] == true, "Not paticipant");
        require(sales[id].maxSupply - sales[id].currentWei * sales[id].vipPercent + msg.value >= 0, "insufficient supply");
        require(block.timestamp < sales[id].endTime, "Sale is over");
        _;
  }

  event CreateSale (string _name, uint256 _maxSupply,  uint256 _minPerBuy, uint256 _maxPerBuy, address _token, uint256 _softgoal, uint8 _joinPercent, uint8 _vipPercent);
    event Buy(string name, uint256 amount, uint256 currentSupply);
    event Claim(string name, uint256 amount);

    function createSale(string memory _name, uint256 _maxSupply, uint256 _minPerBuy, uint256 _maxPerBuy, address _token, uint256 _softgoal, uint8 _joinPercent, uint8 _vipPercent) public onlyOwner {
        Sale memory sale;
        sale.name = _name;
        sale.maxSupply = _maxSupply;
        sale.minPerBuy = _minPerBuy;
        sale.maxPerBuy = _maxPerBuy;
        sale.token = IERC20(_token);
        sale.softGoal = _softgoal;
        sale.joinPercent = _joinPercent;
        sale.vipPercent = _vipPercent;
        sale.currentSupply = _maxSupply;

        sales.push(sale);
        saleId[_name] = uint8(sales.length-1);

        emit CreateSale(_name, _maxSupply,  _minPerBuy, _maxPerBuy, _token, _softgoal, _joinPercent, _vipPercent);
    }

    function register(address user) public onlyOwner {
        participants[user] = true;
    }

    function registerVip(address user) public onlyOwner {
        require(totalDeposit(user) >= depositAmountThresh && totalTime(user) >= depositTimeThresh, "Vip condition invalid");
        whitelist[user] = true;
    }

    function totalDeposit(address user) private view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 0; i < sales.length; i++) {
            total += userDeposit[user][i].deposit;
        }  

        return total;
    }

    function totalTime(address user) private view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 0; i < sales.length; i++) {
            if(userDeposit[user][i].deposit != 0) total++;
        }  

        return total;
    }



    function changeVipCondition(uint8 _depositAmountThresh, uint8 _depositTimeThresh) public onlyOwner {
        require(_depositAmountThresh > 0 && _depositTimeThresh > 0, "Thresh invalid");
        depositAmountThresh = _depositAmountThresh;
        depositTimeThresh = _depositTimeThresh;
    }

    function startSale(string memory name, uint256 duration) public onlyOwner {
        Sale storage sale = sales[saleId[name]];
        require(sale.maxSupply != 0, "Sale not exist");
        require(sale.saleState == 0, "Sale state is not Initialized");

        sale.startTime = block.timestamp;
        sale.endTime = sale.startTime + duration;

        sale.saleState = 1;
    }

    function buy(string memory name) external payable depositCondition(saleId[name]){
        uint8 id = saleId[name];

        userDeposit[msg.sender][id].deposit += msg.value;
        sales[id].currentWei += msg.value;
        sales[id].totalBought++;

        if (whitelist[msg.sender]) {
            sales[id].currentSupply -= userDeposit[msg.sender][saleId[name]].deposit * sales[id].vipPercent;
        } else {
            sales[id].currentSupply -= userDeposit[msg.sender][saleId[name]].deposit * sales[id].joinPercent;
        }

        emit Buy(name, msg.value, sales[id].currentSupply);
    }

    function endSale(string memory name) public onlyOwner {
        Sale storage sale = sales[saleId[name]];
        require(sale.saleState == 1, "Sale is not Active");
        require(block.timestamp > sale.endTime, "Sale not over yet");

        if(sale.softGoal > sale.currentWei) {
            sale.saleState = 2;
        } else sale.saleState = 3;
    }

    function claim(string memory name) external {
        require(participants[msg.sender] == true, "Not paticipant");
        Sale storage sale = sales[saleId[name]];
        require(sale.saleState == 2 || sale.saleState == 3, "Sale is not finish");
        uint256 amount = 0;

        if(sale.saleState == 2) {
            payable (msg.sender).transfer(userDeposit[msg.sender][saleId[name]].deposit);
        } else {
            if (whitelist[msg.sender]) {
                amount = userDeposit[msg.sender][saleId[name]].deposit * sale.vipPercent;
            } else {
                amount = userDeposit[msg.sender][saleId[name]].deposit * sale.joinPercent;
            } 
            sale.token.safeTransferFrom(owner, msg.sender, amount);
        }

        emit Claim(name, amount);
    }

    function withdraw(string memory name) public onlyOwner {
        Sale memory sale = sales[saleId[name]];
        require(sale.saleState == 3, "Sale is not final");
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

    function getTotalBought(string memory name) public view returns(uint256) {
        uint8 id = saleId[name];
        return sales[id].totalBought;
    }

}