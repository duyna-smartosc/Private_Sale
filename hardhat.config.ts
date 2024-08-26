require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.24",
    networks: {
        testnet: {
            url: "https://sepolia.infura.io/v3/2650dbb66fdd4718b2e4a47964f97a6a",
            chainId: 11155111,
            accounts: [process.env.PRIV_KEY],
        },
    },
    etherscan: {
        apiKey: process.env.API_KEY,
    },
};
