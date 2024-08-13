const { expect } = require("chai");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");
const { setTimeout } = require("timers/promises");

describe("Buy and sell func test", function () {
  let PrivateSale;
  let MyERC20Token;
  let owner, addr1, addr2;
  let MyERC20TokenAddress;
  let PrivateSaleAddress;
  let duration = 1000;

  // const newSale = {
  //   name,
  //   saleProperties: [
  //     currentSupply,
  //     maxSupply,
  //     softGoal,
  //     minPerBuy,
  //     maxPerBuy,
  //     currentWei,
  //     startTime,
  //     endTime,
  //   ],
  //   saleFinances: [totalTimeBought, joinPercent, vipPercent],
  //   saleState,
  //   token,
  // };

  const name = "thang_test";
  const nameBytes32 = ethers.encodeBytes32String(name);
  const saleProperties = [0, 50000, 20000, 10, 40000, 0, 0, 0];
  const saleFinances = [0, 2, 3];
  const newSale = {
    name: nameBytes32,
    saleProperties: saleProperties,
    saleFinances: saleFinances,
    saleState:0,
    token: ethers.ZeroAddress
    };

  async function deployContract() {
    [owner, addr1, addr2] = await ethers.getSigners();
    PrivateSale = await ethers.deployContract("PrivateSale");

    await PrivateSale.waitForDeployment();
    PrivateSaleAddress = PrivateSale.getAddress();

    await PrivateSale.changeVipCondition(0, 0);
    await PrivateSale.register(addr1.address);
    await PrivateSale.registerVip(addr1.address);

    MyERC20Token = await ethers.deployContract("MyERC20Token");
    MyERC20TokenAddress = MyERC20Token.getAddress();
    await MyERC20Token.approve(PrivateSaleAddress, 50000);
  }

  async function createSale() {
    await PrivateSale.createSale(newSale, MyERC20TokenAddress);
  }

  describe("check function create sale", function () {
    before(async function () {
      await loadFixture(deployContract);
    });

    it("only owner can create sale", async function () {
      await expect(
        PrivateSale.connect(addr1).createSale(newSale, MyERC20TokenAddress)
      ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
    });

    it("check sale information", async function () {
      //check data before
      expect(PrivateSale.getSale(newSale.name) == 0);

      await PrivateSale.createSale(newSale, MyERC20TokenAddress);

      //check data after
      const sale = PrivateSale.getSale(newSale.name);
      expect(sale.name == newSale.name && sale.token == MyERC20TokenAddress);
    });

    it("check emit event", async function () {
      await expect(
        PrivateSale.createSale(newSale, MyERC20TokenAddress)
      ).to.emit(PrivateSale, "CreateSale");
    });
  });

  describe("buy function", function () {
    beforeEach(async function () {
      // Assuming `whitelist` is a public mapping
      await loadFixture(deployContract);
      await loadFixture(createSale);
    });
    it("Should revert if the sale is not active", async function () {
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.encodeBytes32String("thang_test"), {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(PrivateSale, "SaleNotActive");
    });

    it("Should revert if sale is over", async function () {
      // Simulate the sale being over by advancing the block timestamp
      await ethers.provider.send("evm_increaseTime", [100000000]);
      await PrivateSale.startSale(nameBytes32, 1);
      await setTimeout(2000);
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.encodeBytes32String("thang_test"), {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(PrivateSale, "SaleIsOver");
    });

    it("Should revert if input value is invalid", async function () {
      await PrivateSale.startSale(nameBytes32, 3);
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.encodeBytes32String("thang_test"), {
            value: ethers.parseEther("0.5"),
          })
      ).to.be.revertedWithCustomError(PrivateSale, "InputInvalid");
    });

    it("Should revert if there is insufficient supply in sale", async function () {
      // Assuming saleProperties[1] has a maximum supply
      // Set saleProperties[1] to 0 for testing purposes
      await PrivateSale.startSale(nameBytes32, 2);
      //sale.saleProperties[1] = 0;
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.encodeBytes32String("thang_test"), {
            value: 40000,
          })
      ).to.be.revertedWithCustomError(PrivateSale, "InsufficientSupplyInSale");
    });

    it("Should process a valid purchase", async function () {
      // Set sale to active
      await PrivateSale.startSale(nameBytes32, 2);
      // sale.saleState = 1; // Assuming 1 corresponds to SaleState.ACTIVE

      // Add user to whitelist
      //PrivateSale.whitelist[addr1.address] = true;

      // Process a valid purchase
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.encodeBytes32String("thang_test"), {
            value: 10000,
          })
      ).to.changeEtherBalance(addr1, -10000);

      const saleId = await PrivateSale.checksaleId(nameBytes32);

      const userDeposit = await PrivateSale.checkUserDeposit(addr1.address, saleId);
      expect(userDeposit.deposit).to.equal(10000);
    });

    // Add more tests as needed to cover all scenarios
  });

  xdescribe("claim function", function () {
    beforeEach(async function () {
      // Fund the sale contract with some tokens for testing
      await MyERC20Token.transfer(PrivateSale.address, ethers.parseEther("1000"));

      // Set the sale state to CANCELLED or FINALIZED for different tests
      const sale = await PrivateSale.getSale(sale.name);
      sale.saleState = 2; // Assuming 2 corresponds to SaleState.CANCELED
    });
    it("Should revert if the sale is neither CANCELLED nor FINALIZED", async function () {
      sale.saleState = 1; // Assuming 1 corresponds to SaleState.ACTIVE
      await expect(
        PrivateSale.connect(addr1).claim(ethers.encodeBytes32String("thang_test"))
      ).to.be.revertedWithCustomError(PrivateSale, "SaleNotOver");
    });

    it("Should allow users to reclaim Wei from a canceled sale", async function () {
      // Simulate a deposit from addr1
      await PrivateSale
        .connect(addr1)
        .buy(ethers.encodeBytes32String("thang_test"), {
          value: ethers.parseEther("1"),
        });

      // Set sale state to CANCELLED
      sale.saleState = 2 // Assuming 2 corresponds to SaleState.CANCELED

      // Claim the refund
      await expect(() =>
        PrivateSale.connect(addr1).claim(ethers.encodeBytes32String("thang_test"))
      ).to.changeEtherBalance(addr1, ethers.parseEther("1"));

      const saleId = await sale.checksaleId(sale.name);
      const userDeposit = await PrivateSale.userDeposit[addr1.address][saleId];
      expect(userDeposit).to.equal(0); // Ensure the deposit was refunded
    });

    it("Should allow users to claim tokens from a finalized sale", async function () {
      // Simulate a deposit from addr1
      await PrivateSale
        .connect(addr1)
        .buy(ethers.encodeBytes32String("thang_test"), {
          value: ethers.parseEther("1"),
        });

      // Set sale state to FINALIZED
      sale.saleState = 3 // Assuming 3 corresponds to SaleState.FINALIZED

      // Add user to whitelist for claiming bonuses
      PrivateSale.whitelist[addr1.address] = true;

      // Claim the tokens
      await PrivateSale.connect(addr1).claim(ethers.encodeBytes32String("thang_test"));

      const tokenBalance = await MyERC20Token.balanceOf(addr1.address);
      expect(tokenBalance).to.be.gt(0); // Ensure the user received tokens
    });

    // Add more tests as needed to cover all scenarios
  });
});
