import { ethers } from "hardhat";

async function main() {
  const initialBalance = await (await ethers.getSigners())[0].getBalance();

  const ElvatePairFactory = await ethers.getContractFactory("ElvatePair");
  const ElvatePair = await ElvatePairFactory.deploy();
  await ElvatePair.deployed();
  console.log("ElvatePair deployed to:", ElvatePair.address);

  const ElvateSubscriptionFactory = await ethers.getContractFactory(
    "ElvateSubscription"
  );
  const ElvateSubscription = await ElvateSubscriptionFactory.deploy();
  await ElvateSubscription.deployed();
  console.log("ElvateSubscription deployed to:", ElvateSubscription.address);

  await ElvateSubscription.updateElvatePairAddress(ElvatePair.address);
  console.log("ElvateSubscription configured with ElvatePair address");

  const newBalance = await (await ethers.getSigners())[0].getBalance();
  console.log("cost: ", initialBalance.sub(newBalance).toString());
  console.log("new balance: ", newBalance.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
