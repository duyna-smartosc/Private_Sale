const { expect } = require("chai");
const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { setTimeout } = require("timers/promises");

describe("Test contract for init sale", function () {
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

    //TC01
    describe("Check functions create sale", function () {
        before(async function () {
            await loadFixture(deployContract);
        });

        //TC01_1
        it("Only owner can create sale", async function () {
            await expect(
                PrivateSale.connect(user1).createSale(
                    newSale,
                    MyERC20TokenAddress
                )
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        //TC01_2
        it("Create sale successfully", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            //check data after
            const id = await PrivateSale.checksaleId(newSale.name);
            const sale = await PrivateSale.getSale(id);

            expect(sale.name).to.be.equal(newSale.name);
            expect(sale.token).to.be.equal(MyERC20TokenAddress);
        });

        //TC01_3
        it("Check emit event after create sale successfully", async function () {
            const newSale = {
                name: ethers.encodeBytes32String("myToken"),
                saleProperties: [0, 50000, 20000, 10, 40000, 0, 0, 0],
                saleFinances: [0, 2, 3],
                saleState: 0,
                token: ethers.ZeroAddress,
            };

            await expect(PrivateSale.createSale(newSale, MyERC20TokenAddress))
                .to.emit(PrivateSale, "SaleCreated")
                .withArgs((sale) => {
                    expect(sale.name).to.equal(
                        ethers.encodeBytes32String("myToken")
                    );
                    expect(sale.saleProperties).to.deep.equal([
                        BigInt(50000),
                        BigInt(50000),
                        BigInt(20000),
                        BigInt(10),
                        BigInt(40000),
                        BigInt(0),
                        BigInt(0),
                        BigInt(0),
                    ]);

                    expect(sale.saleFinances).to.deep.equal([
                        BigInt(0),
                        BigInt(2),
                        BigInt(3),
                    ]);
                    expect(sale.saleState).to.equal(0);
                    expect(sale.token).to.equal(
                        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
                    );
                    return true;
                });
        });
    });

    //TC02
    describe("Check function start sale", async function () {
        before(async function () {
            await loadFixture(deployContract);
        });

        //TC02_1
        it("Only owner can start sale", async function () {
            await expect(
                PrivateSale.connect(user1).startSale(newSale.name, duration)
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        //TC02_2
        it("Should revert if create sale when sale is not create", async function () {
            await expect(
                PrivateSale.startSale(newSale.name, duration)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotExist");
        });

        //TC02_3
        it("Should revert if input duration invalid", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            await expect(
                PrivateSale.startSale(newSale.name, 0)
            ).to.be.revertedWithCustomError(PrivateSale, "InputInvalid");
        });

        //TC02_4
        it("Check time of sale when start sale successfully", async function () {
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

        //TC02_5
        it("Check status of sale when start sale successfully ", async function () {
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

    //TC03
    describe("Check function end sale", async function () {
        before(async function () {
            await loadFixture(deployContract);
        });

        //TC03_1
        it("Only owner can end sale", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);

            await expect(
                PrivateSale.connect(user1).endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "NotOwner");
        });

        //TC03_2
        it("Should revert when end sale if sale is not start", async function () {
            await expect(
                PrivateSale.endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotActive");
        });

        //TC03_3
        it("Should revert when end sale when sale is not over", async function () {
            await PrivateSale.createSale(newSale, MyERC20TokenAddress);
            await PrivateSale.startSale(newSale.name, duration);

            await expect(
                PrivateSale.endSale(newSale.name)
            ).to.be.revertedWithCustomError(PrivateSale, "SaleNotOver");
        });

        //TC03_4
        it("Check status of sale when sale cancel", async function () {
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
