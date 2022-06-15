import { ethers } from "hardhat";
import { ElvateCore } from "../typechain/ElvateCore";

async function main() {
  const initialBalance = await (await ethers.getSigners())[0].getBalance();

  const coreFactory = await ethers.getContractFactory("ElvateCore");
  const core = (await coreFactory.deploy(
    "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"
  )) as ElvateCore;
  await core.deployed();
  console.log("ElvateCore deployed to:", core.address);

  const newBalance = await (await ethers.getSigners())[0].getBalance();
  console.log("cost: ", ethers.utils.formatEther(initialBalance.sub(newBalance)));
  console.log("new balance: ", ethers.utils.formatEther(newBalance));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
