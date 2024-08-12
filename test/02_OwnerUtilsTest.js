const {expect} = require('chai')
const {ethers} = require('hardhat')
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");

const { setTimeout } = require("timers/promises");

describe("other owner`s functions test", function () {
  var provider;
  var PrivateSale;
  var MyERC20Token;
  var owner, user1, user2;

  
  async function deployContract() {
    provider = ethers.provider;
    [owner, user1, user2] = await ethers.getSigners();
    PrivateSale = await ethers.deployContract("PrivateSale");
    
    await PrivateSale.waitForDeployment();
  }

  async function createSale() {
    await PrivateSale.connect(owner);
    MyERC20Token = await ethers.deployContract("MyERC20Token");
    await MyERC20Token.waitForDeployment();
    const MyERC20TokenAddress = await MyERC20Token.getAddress();

    const PrivateSaleAddress = await PrivateSale.getAddress();
    await MyERC20Token.approve(PrivateSaleAddress, 50000);

    const name = "sh";
    const nameBytes32 = ethers.encodeBytes32String(name);
    const saleProperties = [0, 50000, 20000, 10, 40000, 0, 0, 0];
    const saleFinances = [0, 2, 3];
    const newSale = {
    name: nameBytes32,
    saleProperties: saleProperties,
    saleFinances: saleFinances,
    saleState:0,
    token: ethers.ZeroAddress
    }
    await PrivateSale.createSale(newSale, MyERC20TokenAddress);
  }

  //TC01
  describe("register normal participants", function() {
    before(async function () {
      //await hre.network.provider.send("hardhat_reset");
      await loadFixture(deployContract);
    })
    
    //TC01_1
    it("non registered user shouldnt be participants", async function() {
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(false);
    })
    
    //TC01_2
    it("user should be register successfully", async function() {
      await PrivateSale.register(user1.address);
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(true);
    })
    
    //TC01_3
    it("user already registered should revert", async function() {
      await expect(PrivateSale.register(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'AlreadyParticipant');
    })
  })
  
  //TC02
  describe("register whitelist participants", function() {
    before(async function () {
      await loadFixture(deployContract);
      await loadFixture(createSale);
    })
    
    //TC02_1
    it("register non participant for whitelist should revert", async function() {
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(false);
      await expect(PrivateSale.registerVip(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'NotParticipant');
    })
    
    //TC02_2
    it("register ineligible participant for whitelist should revert", async function() {
      await PrivateSale.register(user1.address);
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(true);
      await expect(PrivateSale.registerVip(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'VipConditionUnsastified');
    })

    //TC02_3
    it("owner should be able to change whitelist condition", async function() {
      await PrivateSale.changeVipCondition(1, 1);
      expect(await PrivateSale.getDepositAmountThresh()).to.be.equal(1);
      expect(await PrivateSale.getDepositTimeThresh()).to.be.equal(1);
    })

    //TC02_4
    it("owner should be able to register eligible participant for whitelist", async function() {
      expect(await PrivateSale.checkWhiteList(user1.address)).to.be.equal(false);
      const nameBytes32 = ethers.encodeBytes32String("sh");
      await PrivateSale.startSale(nameBytes32, 3);
      await PrivateSale.connect(user1).buy(nameBytes32, {
        value: 100,
      });
      const userSaleDeposit = await PrivateSale.connect(owner).checkUserDeposit(user1.address, 0);
      expect(userSaleDeposit.deposit).to.be.equal(100);
      await PrivateSale.registerVip(user1.address);
      expect(await PrivateSale.checkWhiteList(user1.address)).to.be.equal(true);
    })

    it("vip already registered should revert", async function () {
      await expect(PrivateSale.registerVip(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'AlreadyVip');
    })
  })

  //TC03
  describe("withdraw wei from sale test", function() {
    beforeEach(async function () {
      await loadFixture(deployContract);
      await loadFixture(createSale);
    })

    //TC03_1
    it("owner shouldnt be able to withdraw from sale if sale is not finish or not finalized", async function() {
      const weiDeposit = 100;
      const nameBytes32 = ethers.encodeBytes32String("sh");
      await PrivateSale.startSale(nameBytes32, 2);
      await PrivateSale.register(user1.address);
      await PrivateSale.connect(user1).buy(nameBytes32, {
        value: weiDeposit,
      });
      await PrivateSale.connect(owner);
      await expect(PrivateSale.withdraw(nameBytes32)).to.be.revertedWithCustomError(PrivateSale, 'SaleNotFinalized');
      await setTimeout(3000);
      console.log("Waited 3s");
      await PrivateSale.endSale(nameBytes32);
      await expect(PrivateSale.withdraw(nameBytes32)).to.be.revertedWithCustomError(PrivateSale, 'SaleNotFinalized');
    })

    //TC03_2
    it("owner should be able to withdraw from sale if sale is finalized", async function() {
      const weiDeposit = 30000;
      const nameBytes32 = ethers.encodeBytes32String("sh");
      await PrivateSale.startSale(nameBytes32, 2);
      await PrivateSale.register(user1.address);
      await PrivateSale.connect(user1).buy(nameBytes32, {
        value: weiDeposit,
      });
      await PrivateSale.connect(owner);
      await setTimeout(3000);
      console.log("Waited 3s");
      await PrivateSale.endSale(nameBytes32);
      expect(await PrivateSale.withdraw(nameBytes32)).to.changeEtherBalance(owner, `+${weiDeposit}`);
    })
  })
    
})