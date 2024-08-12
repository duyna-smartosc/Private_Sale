const { expect } = require("chai");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {
  currentSupply,
  maxSupply,
  softGoal,
  minPerBuy,
  maxPerBuy,
  currentWei,
  startTime,
  endTime,
  vipPercent,
  joinPercent,
  totalTimeBought,
  name,
  saleState,
  token,
} = require("../utils/environment");
const { ethers } = require("hardhat");

describe("Buy and sell func test", function () {
  let PrivateSale;
  let MyERC20Token;
  let owner, user1, user2;
  let MyERC20TokenAddress;
  let PrivateSaleAddress;
  let duration = 1000;

  const newSale = {
    name,
    saleProperties: [
      currentSupply,
      maxSupply,
      softGoal,
      minPerBuy,
      maxPerBuy,
      currentWei,
      startTime,
      endTime,
    ],
    saleFinances: [totalTimeBought, joinPercent, vipPercent],
    saleState,
    token,
  };

  async function deployContract() {
    [owner, user1, user2] = await ethers.getSigners();
    PrivateSale = await ethers.deployContract("PrivateSale");

    await PrivateSale.waitForDeployment();
    PrivateSaleAddress = PrivateSale.getAddress();

    MyERC20Token = await ethers.deployContract("MyERC20Token");
    MyERC20TokenAddress = MyERC20Token.getAddress();
    await MyERC20Token.approve(PrivateSaleAddress, 50000);
  }

  describe("check function create sale", function () {
    before(async function () {
      await loadFixture(deployContract);
    });

    it("only owner can create sale", async function () {
      await expect(
        PrivateSale.connect(user1).createSale(newSale, MyERC20TokenAddress)
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
      whitelist = await PrivateSale.whitelist(owner.address);
    });
    it("Should revert if the sale is not active", async function () {
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.utils.formatBytes32String("thang_test"), {
            value: ethers.utils.parseEther("1"),
          })
      ).to.be.revertedWith("SaleNotActive");
    });

    it("Should revert if sale is over", async function () {
      // Simulate the sale being over by advancing the block timestamp
      await ethers.provider.send("evm_increaseTime", [100000000]);
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.utils.formatBytes32String("thang_test"), {
            value: ethers.utils.parseEther("1"),
          })
      ).to.be.revertedWith("SaleIsOver");
    });

    it("Should revert if input value is invalid", async function () {
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.utils.formatBytes32String("thang_test"), {
            value: ethers.utils.parseEther("0.5"),
          })
      ).to.be.revertedWith("InputInvalid");
    });

    it("Should revert if there is insufficient supply in sale", async function () {
      // Assuming saleProperties[1] has a maximum supply
      // Set saleProperties[1] to 0 for testing purposes
      const sale = await PrivateSale.getSale(newSale.name);
      sale.saleProperties[1] = 0;
      await expect(
        PrivateSale
          .connect(addr1)
          .buy(ethers.utils.formatBytes32String("thang_test"), {
            value: ethers.utils.parseEther("1"),
          })
      ).to.be.revertedWith("InsufficientSupplyInSale");
    });

    it("Should process a valid purchase", async function () {
      // Set sale to active
      sale.saleState = 1; // Assuming 1 corresponds to SaleState.ACTIVE

      // Add user to whitelist
      PrivateSale.whitelist[addr1.address] = true;

      // Process a valid purchase
      await expect(() =>
        PrivateSale
          .connect(addr1)
          .buy(ethers.utils.formatBytes32String("thang_test"), {
            value: ethers.utils.parseEther("1"),
          })
      ).to.changeEtherBalance(addr1, ethers.utils.parseEther("-1"));

      const saleId = await PrivateSale.checksaleId(sale.name)

      const userDeposit = await PrivateSale.userDeposit[addr1.address][saleId];
      expect(userDeposit).to.equal(ethers.utils.parseEther("1"));
    });

    // Add more tests as needed to cover all scenarios
  });

  describe("claim function", function () {
    beforeEach(async function () {
      // Fund the sale contract with some tokens for testing
      await MyERC20Token.transfer(PrivateSale.address, ethers.utils.parseEther("1000"));

      // Set the sale state to CANCELLED or FINALIZED for different tests
      const sale = await PrivateSale.getSale(sale.name);
      sale.saleState = 2; // Assuming 2 corresponds to SaleState.CANCELED
    });
    it("Should revert if the sale is neither CANCELLED nor FINALIZED", async function () {
      sale.saleState = 1; // Assuming 1 corresponds to SaleState.ACTIVE
      await expect(
        PrivateSale.connect(addr1).claim(ethers.utils.formatBytes32String("thang_test"))
      ).to.be.revertedWith("SaleNotOver");
    });

    it("Should allow users to reclaim Wei from a canceled sale", async function () {
      // Simulate a deposit from addr1
      await PrivateSale
        .connect(addr1)
        .buy(ethers.utils.formatBytes32String("thang_test"), {
          value: ethers.utils.parseEther("1"),
        });

      // Set sale state to CANCELLED
      sale.saleState = 2 // Assuming 2 corresponds to SaleState.CANCELED

      // Claim the refund
      await expect(() =>
        PrivateSale.connect(addr1).claim(ethers.utils.formatBytes32String("thang_test"))
      ).to.changeEtherBalance(addr1, ethers.utils.parseEther("1"));

      const saleId = await sale.checksaleId(sale.name);
      const userDeposit = await PrivateSale.userDeposit[addr1.address][saleId];
      expect(userDeposit).to.equal(0); // Ensure the deposit was refunded
    });

    it("Should allow users to claim tokens from a finalized sale", async function () {
      // Simulate a deposit from addr1
      await PrivateSale
        .connect(addr1)
        .buy(ethers.utils.formatBytes32String("thang_test"), {
          value: ethers.utils.parseEther("1"),
        });

      // Set sale state to FINALIZED
      sale.saleState = 3 // Assuming 3 corresponds to SaleState.FINALIZED

      // Add user to whitelist for claiming bonuses
      PrivateSale.whitelist[addr1.address] = true;

      // Claim the tokens
      await PrivateSale.connect(addr1).claim(ethers.utils.formatBytes32String("thang_test"));

      const tokenBalance = await MyERC20Token.balanceOf(addr1.address);
      expect(tokenBalance).to.be.gt(0); // Ensure the user received tokens
    });

    // Add more tests as needed to cover all scenarios
  });
});
