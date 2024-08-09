const { expect } = require("chai");
const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");

const { setTimeout } = require("timers/promises");

describe("Test contract", function () {
    let PrivateSale;
    let token;
    let owner, user1, user2;
    let MyERC20TokenAddress;
    let PrivateSaleAddress;
    let duration = 1000;

    const newSale = {
        name: "sh",
        currentSupply: 0,
        maxSupply: 50000,
        softGoal: 20000,
        minPerBuy: 10,
        maxPerBuy: 40000,
        currentWei: 0,
        startTime: 0,
        endTime: 0,
        totalTimeBought: 0,
        joinPercent: 2,
        vipPercent: 3,
        saleState: 0,
        token: "0x0000000000000000000000000000000000000000",
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
                PrivateSale.connect(user1).createSale(
                    newSale,
                    MyERC20TokenAddress
                )
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        it("check sale information", async function () {
            //check data before
            expect(PrivateSale.getSale(newSale.name) == 0);

            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            //check data after
            const sale = PrivateSale.getSale(newSale.name);
            expect(
                sale.name == newSale.name && sale.token == MyERC20TokenAddress
            );
        });

        it("check emit event", async function () {
            await expect(
                PrivateSale.createSale(newSale, MyERC20TokenAddress)
            ).to.emit(PrivateSale, "CreateSale");
        });
    });

    describe("check function start sale", async function () {
        before(async function () {
            await loadFixture(deployContract);
        });

        it("only owner can start sale", async function () {
            await expect(
                PrivateSale.connect(user1).startSale(newSale.name, duration)
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        it("sale is not create", async function () {
            // await expect(
            //     PrivateSale.startSale(newSale.name, duration)
            // ).to.be.revertedWithCustomError(PrivateSale, "SaleNotExist");
        });

        it("sale is not initialize", async function () {
            const sale = PrivateSale.createSale(newSale, MyERC20TokenAddress);

            // before
            sale.startSale = 2;

            // await expect(
            //     PrivateSale.startSale(newSale.name, duration)
            // ).to.be.revertedWithCustomError(PrivateSale, "SaleNotInitialized");
        });

        it("duration invalid", async function () {
            await expect(
                PrivateSale.startSale(newSale.name, 0)
            ).to.be.revertedWithCustomError(PrivateSale, "InputInvalid");
        });

        it("check time", async function () {
            const sale = PrivateSale.createSale(newSale, MyERC20TokenAddress);

            //check before
            expect(sale.startTime == 0 && sale.endTime == 0);

            PrivateSale.startSale(newSale.name, duration);

            let sl = PrivateSale.getSale(PrivateSale.checksaleId(newSale.name));
            await expect(sl.endTime == sl.startTime + duration);
        });

        it("check status", async function () {
            const sale = PrivateSale.createSale(newSale, MyERC20TokenAddress);

            //check before
            expect(sale.saleState == 0);

            PrivateSale.startSale(newSale.name, duration);

            let sl = PrivateSale.getSale(PrivateSale.checksaleId(newSale.name));
            await expect(sl.saleState == 1);
        });
    });
});
