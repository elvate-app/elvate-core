import { expect } from "chai";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { ElvateCore } from "../typechain/ElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

const createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let wrapped: WETH9;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

describe("Elvate Withdraw Fees", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
  });

  describe("Initialisation", () => {
    it("revert on no fees", async () => {
      await expect(core.withdrawFees()).to.revertedWith("Nothing to withdraw");
    });
  });

  describe("Update fees values", () => {
    it("return correct value after update", async () => {
      await core.updateFees(10, 20);
      expect(await core.pairCreationFees()).to.eq(20);
      expect(await core.swapFees()).to.eq(10);
    });

    it("return correct value after disabling fees", async () => {
      await core.updateFees(0, 0);
      expect(await core.pairCreationFees()).to.eq(0);
      expect(await core.swapFees()).to.eq(0);
    });

    it("return correct value after setting to max value", async () => {
      await core.updateFees(BigNumber.from(2).pow(16).sub(1), BigNumber.from(2).pow(128).sub(1));
      expect(await core.pairCreationFees()).to.eq(BigNumber.from(2).pow(128).sub(1));
      expect(await core.swapFees()).to.eq(BigNumber.from(2).pow(16).sub(1));
    });

    it("revert on swap fees too hight", async () => {
      await expect(core.updateFees(BigNumber.from(2).pow(16), 0)).to.reverted;
    });

    it("revert on pair creation fees too hight", async () => {
      await expect(core.updateFees(BigNumber.from(2).pow(128), 0)).to.reverted;
    });

    it("revert on other", async () => {
      await expect(core.connect(other).updateFees(10, 20)).to.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Withdraw pair creation fees", () => {
    beforeEach("init pair", async () => {
      const fees = await core.pairCreationFees();
      await core.connect(other).createPair(token0.address, token1.address, { value: fees });
    });

    it("return correct values on withdraw", async () => {
      const fees = await core.pairCreationFees();
      const initialBalance = await wallet.getBalance();
      expect(await ethers.provider.getBalance(core.address)).to.eq(fees);
      const tx = await core.withdrawFees();
      const reicipe = await tx.wait();
      expect(await ethers.provider.getBalance(core.address)).to.eq(0);
      expect(await wallet.getBalance()).to.eq(
        initialBalance.add(fees).sub(reicipe.effectiveGasPrice.mul(reicipe.cumulativeGasUsed))
      );
    });

    it("revert with other", async () => {
      await expect(core.connect(other).withdrawFees()).to.revertedWith("Ownable: caller is not the owner");
    });
  });
});
