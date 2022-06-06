import { ethers } from "hardhat";
import { ElvateCore } from "../typechain/ElvateCore";

async function main() {
  const initialBalance = await (await ethers.getSigners())[0].getBalance();

  const coreFactory = await ethers.getContractFactory("ElvateCore");
  const core = (await coreFactory.deploy()) as ElvateCore;
  await core.deployed();
  console.log("ElvateCore deployed to:", core.address);

  await core.updateContractAddresses(
    "0x8954AfA98594b838bda56FE4C12a09D7739D179b",
    "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"
  );
  console.log("ElvateCore configured");

  const newBalance = await (await ethers.getSigners())[0].getBalance();
  console.log(
    "cost: ",
    ethers.utils.formatEther(initialBalance.sub(newBalance))
  );
  console.log("new balance: ", ethers.utils.formatEther(newBalance));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
