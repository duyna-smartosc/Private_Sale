const {expect} = require('chai')
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");

const { setTimeout } = require("timers/promises");

describe("common contract test", function () {
  var provider;
  var PrivateSale;
  var MyERC20Token;
  var owner, user1, user2;

  
  async function deployContract() {
    provider = ethers.provider;
    [owner, user1, user2] = await ethers.getSigners();
    PrivateSale = await ethers.deployContract("PrivateSale");
    
    await PrivateSale.waitForDeployment();
    // const PrivateSaleAddress = await PrivateSale.getAddress();
    // return PrivateSaleAddress;
  }

  // async function deployToken() {
  //   // provider = await ethers.getDefaultProvider();
  //   // [owner, user1, user2] = await ethers.getSigners();
  //   MyERC20Token = await ethers.deployContract("MyERC20Token");
    
  //   await MyERC20Token.waitForDeployment();
  //   const MyERC20TokenAddress = await MyERC20Token.getAddress();
  //   return MyERC20TokenAddress;
  // }

  async function createSale() {
    await PrivateSale.connect(owner);
    MyERC20Token = await ethers.deployContract("MyERC20Token");
    await MyERC20Token.waitForDeployment();
    const MyERC20TokenAddress = await MyERC20Token.getAddress();

    const PrivateSaleAddress = await PrivateSale.getAddress();
    await MyERC20Token.approve(PrivateSaleAddress, 50000);

    const newSale = {
    name: "sh",
    currentSupply: 0,
    maxSupply: 50000,
    softGoal: 20000,
    minPerBuy: 10,
    maxPerBuy:40000,
    currentWei:0,
    startTime:0,
    endTime:0,
    totalTimeBought:0,
    joinPercent: 2,
    vipPercent: 3,
    saleState:0,
    token: "0x0000000000000000000000000000000000000000"
    }
    await PrivateSale.createSale(newSale, MyERC20TokenAddress);
  }

  describe("register normal participants", function() {
    before(async function () {
      //await hre.network.provider.send("hardhat_reset");
      await loadFixture(deployContract);
    })

    it("non registered user shouldnt be participants", async function() {
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(false);
    })
  
    it("user should be register successfully", async function() {
      await PrivateSale.register(user1.address);
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(true);
    })
  
    it("user already registered should revert", async function() {
      await expect(PrivateSale.register(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'AlreadyParticipant');
    })
  })
  
  describe("register whitelist participants", function() {
    before(async function () {
      await loadFixture(deployContract);
      await loadFixture(createSale);
    })

    it("register non participant for whitelist should revert", async function() {
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(false);
      await expect(PrivateSale.registerVip(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'NotParticipant');
    })
  
    it("register ineligible participant for whitelist should revert", async function() {
      await PrivateSale.register(user1.address);
      expect(await PrivateSale.checkParticipants(user1.address)).to.equal(true);
      await expect(PrivateSale.registerVip(user1.address)).to.be.revertedWithCustomError(PrivateSale, 'VipConditionUnsastified');
    })

    it("owner should be able to change whitelist condition", async function() {
      await PrivateSale.changeVipCondition(1, 1);
      expect(await PrivateSale.getDepositAmountThresh()).to.be.equal(1);
      expect(await PrivateSale.getDepositTimeThresh()).to.be.equal(1);
    })

    it("owner should be able to register eligible participant for whitelist", async function() {
      expect(await PrivateSale.checkWhiteList(user1.address)).to.be.equal(false);
      await PrivateSale.startSale("sh", 3);
      await PrivateSale.connect(user1).buy("sh", {
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

  describe("withdraw wei from sale test", function() {
    beforeEach(async function () {
      await loadFixture(deployContract);
      await loadFixture(createSale);
    })

    it("owner shouldnt be able to withdraw from sale if sale is not finish or not finalized", async function() {
      const weiDeposit = 100;
      await PrivateSale.startSale("sh", 2);
      await PrivateSale.register(user1.address);
      await PrivateSale.connect(user1).buy("sh", {
        value: weiDeposit,
      });
      await PrivateSale.connect(owner);
      await expect(PrivateSale.withdraw("sh")).to.be.revertedWithCustomError(PrivateSale, 'SaleNotFinalized');
      await setTimeout(3000);
      console.log("Waited 3s");
      await PrivateSale.endSale("sh");
      await expect(PrivateSale.withdraw("sh")).to.be.revertedWithCustomError(PrivateSale, 'SaleNotFinalized');
    })

    it("owner should be able to withdraw from sale if sale is finalized", async function() {
      const weiDeposit = 30000;
      await PrivateSale.startSale("sh", 2);
      await PrivateSale.register(user1.address);
      await PrivateSale.connect(user1).buy("sh", {
        value: weiDeposit,
      });
      await PrivateSale.connect(owner);
      await setTimeout(3000);
      console.log("Waited 3s");
      await PrivateSale.endSale("sh");
      expect(await PrivateSale.withdraw("sh")).to.changeEtherBalance(owner, `+${weiDeposit}`);
    })
  })
    
})