const { expect } = require("chai");
const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");

const { setTimeout } = require("timers/promises");

describe("Test contract", function () {
    let PrivateSale;
    let owner, user1, user2;
    let MyERC20TokenAddress;
    let PrivateSaleAddress;
    let duration = 1000;

    const newSale = {
        name: ethers.encodeBytes32String("myToken"),
        saleProperties: [0, 50000, 20000, 10, 40000, 0, 0, 0],
        saleFinances: [0, 2, 3],
        saleState: 0,
        token: ethers.ZeroAddress,
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
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            //check data after
            const id = await PrivateSale.checksaleId(newSale.name);
            const sale = await PrivateSale.getSale(id);

            expect(sale.name).to.be.equal(newSale.name);
            expect(sale.token).to.be.equal(MyERC20TokenAddress);
        });

        // check thoong tin event
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
