const { expect } = require("chai");
const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");

const { setTimeout } = require("timers/promises");

describe("Test contract", function () {
    let PrivateSale;
    let owner, user1;
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
        [owner, user1] = await ethers.getSigners();
        PrivateSale = await ethers.deployContract("PrivateSale");

        await PrivateSale.waitForDeployment();
        PrivateSaleAddress = await PrivateSale.getAddress();

        MyERC20Token = await ethers.deployContract("MyERC20Token");
        MyERC20TokenAddress = await MyERC20Token.getAddress();
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

        xit("check emit event", async function () {
            // const event = await PrivateSale.createSale(
            //     newSale,
            //     MyERC20TokenAddress
            // );
            // console.log(event);
            // assert.equal()

            // const newSale = {
            //     name: ethers.encodeBytes32String("myToken"),
            //     saleProperties: [0, 50000, 20000, 10, 40000, 0, 0, 0],
            //     saleFinances: [0, 2, 3],
            //     saleState: 0,
            //     token: ethers.ZeroAddress,
            // };

            await expect(PrivateSale.createSale(newSale, MyERC20TokenAddress))
                .to.emit(PrivateSale, "CreateSale")
                .withArgs(
                    ethers.encodeBytes32String("myToken"),
                    [0, 50000, 20000, 10, 40000, 0, 0, 0],
                    [0, 2, 3],
                    0,
                    ethers.ZeroAddress
                );
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
            await expect(
                PrivateSale.startSale(newSale.name, duration)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotExist");
        });

        it("duration invalid", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            await expect(
                PrivateSale.startSale(newSale.name, 0)
            ).to.be.revertedWithCustomError(PrivateSale, "InputInvalid");
        });

        it("check time", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);
            const id = await PrivateSale.checksaleId(newSale.name);
            const sale = await PrivateSale.getSale(id);

            expect(sale.saleProperties[6]).to.be.equal(0);
            expect(sale.saleProperties[7]).to.be.equal(0);

            await PrivateSale.startSale(newSale.name, duration);

            let sl = await PrivateSale.getSale(
                PrivateSale.checksaleId(newSale.name)
            );

            expect(sl.saleProperties[7]).to.be.equal(
                sl.saleProperties[6] + BigInt(duration)
            );
        });

        it("check status", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);
            const id = await PrivateSale.checksaleId(newSale.name);
            const sale = await PrivateSale.getSale(id);

            //check before
            expect(sale.saleState).to.be.equal(0);

            await PrivateSale.startSale(newSale.name, duration);

            let sl = await PrivateSale.getSale(
                PrivateSale.checksaleId(newSale.name)
            );
            expect(sl.saleState).to.be.equal(1);
        });
    });

    describe("check function end sale", async function () {
        before(async function () {
            await loadFixture(deployContract);
        });

        it("only owner can end sale", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            await expect(
                PrivateSale.connect(user1).endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        it("sale is not active", async function () {
            await expect(
                PrivateSale.endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotActive");
        });

        it("check sale is not over", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);
            await PrivateSale.startSale(newSale.name, duration);

            await expect(
                PrivateSale.endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotOver");
        });

        it("check sale cancel", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);
            await PrivateSale.startSale(newSale.name, 1);

            await setTimeout(2000);

            await PrivateSale.endSale(newSale.name);
            let sl = await PrivateSale.getSale(
                await PrivateSale.checksaleId(newSale.name)
            );
            expect(sl.saleState).to.be.equal(2);
        });
    });
});
