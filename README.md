# Private Sale Smart Contract

This is a smart contract that represent a factory for private sales of tokens, used by the owner of the contract
## Features
- **Manage sale**: allow owner to create and manage private token sale
- **Set sale duration**: owner can set the duration of a sale and start it
- **Buy token**: user can place a deposit in a specific token sale
- **claim token**: If a sale is finalized, user can claim tokens
- **refunds**: If a sale is canceled, user can reclaim their deposit
- **withdraw money**: Owner can withdraw buyer`s deposit from a finalized sale

## Installing and Running 
### Clone the repository 
```
git clone https://github.com/duyna-smartosc/Private_Sale.git
```
### Install dependencies
Run the command to install all dependencies: 
```
npm install
```
### Compile the smart contracts 
Run the command to compile the smart contracts: 
```
npx hardhat compile
```
### Run the tests
Run the command to run the tests: 
``` 
npx hardhat test
```



