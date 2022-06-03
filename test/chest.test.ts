import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { ElvatePair } from "../typechain/ElvatePair";
import { ElvateSubscription } from "../typechain/ElvateSubscription";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
// let pair: ElvatePair;
// let subscription: ElvateSubscription;
let wrapped: WETH9;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

let fees: BigNumber;

describe("Elvate Core", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
    token0.transfer(
      other.address,
      (await token0.balanceOf(wallet.address)).div(2)
    );
    token1.transfer(
      other.address,
      (await token1.balanceOf(wallet.address)).div(2)
    );
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(coreFixture));
    await core.updateContractAddresses(
      constants.AddressZero,
      constants.AddressZero,
      constants.AddressZero,
      wrapped.address
    );
  });

  describe("Deposits", () => {
    it("Should be init to 0 for owner", async function () {
      expect(
        await core.getDepositedToken(wallet.address, token0.address)
      ).to.eq(0);
      expect(
        await core.getDepositedToken(wallet.address, token1.address)
      ).to.eq(0);
      expect(
        await core.getDepositedToken(wallet.address, token2.address)
      ).to.eq(0);
    });

    it("Should be init to 0 for other", async function () {
      expect(await core.getDepositedToken(other.address, token0.address)).to.eq(
        0
      );
      expect(await core.getDepositedToken(other.address, token1.address)).to.eq(
        0
      );
      expect(await core.getDepositedToken(other.address, token2.address)).to.eq(
        0
      );
    });

    it("Should deposit token0 by owner", async function () {
      await token0.approve(core.address, constants.MaxUint256);
      await core.depositToken(token0.address, 10);
      expect(
        await core.getDepositedToken(wallet.address, token0.address)
      ).to.eq(10);
    });

    it("Should deposit native to wrapped", async function () {
      await core.deposit({ value: 25 });
      expect(
        await core.getDepositedToken(wallet.address, wrapped.address)
      ).to.eq(25);
    });

    it("Should deposit token1 by other", async function () {
      await token1.connect(other).approve(core.address, constants.MaxUint256);
      await core.connect(other).depositToken(token1.address, 60);
      expect(await core.getDepositedToken(other.address, token1.address)).to.eq(
        60
      );
    });

    it("Should deposit token1 by owner", async function () {
      await token1.approve(core.address, constants.MaxUint256);
      await core.depositToken(token1.address, 80);
      expect(
        await core.getDepositedToken(wallet.address, token1.address)
      ).to.eq(80);
    });

    it("Should revert with no allowance", async function () {
      await expect(core.depositToken(token2.address, 80)).to.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("Should revert with insufficient allowance", async function () {
      await token2.approve(core.address, 40);
      await expect(core.depositToken(token2.address, 80)).to.revertedWith(
        "ERC20: insufficient allowance"
      );
    });

    it("Should revert with insufficient funds", async function () {
      await expect(
        core.depositToken(
          token1.address,
          (await token1.balanceOf(wallet.address)).add(1)
        )
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Withdrawal", () => {
    it("Should withdraw for owner ", async function () {
      await core.withdrawToken(token0.address, 10);
      await core.withdrawToken(token1.address, 10);
      expect(
        await core.getDepositedToken(wallet.address, token0.address)
      ).to.eq(0);
      expect(
        await core.getDepositedToken(wallet.address, token1.address)
      ).to.eq(70);
      expect(
        await core.getDepositedToken(wallet.address, token2.address)
      ).to.eq(0);
      await core.withdrawToken(token1.address, 20);
      expect(
        await core.getDepositedToken(wallet.address, token1.address)
      ).to.eq(50);
      await core.withdrawToken(token1.address, 50);
      expect(
        await core.getDepositedToken(wallet.address, token1.address)
      ).to.eq(0);
    });

    it("Should withdraw for other", async function () {
      await core.connect(other).withdrawToken(token1.address, 60);
      expect(await core.getDepositedToken(other.address, token1.address)).to.eq(
        0
      );
    });

    it("Should revert with too hight withdraw amount", async function () {
      await expect(
        core.connect(other).withdrawToken(token1.address, 60)
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should revert with max withdraw amount", async function () {
      await expect(
        core.connect(other).withdrawToken(token1.address, constants.MaxUint256)
      ).to.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Events", () => {
    it("Should emit an event on token deposit", async function () {
      await expect(core.depositToken(token1.address, 45))
        .to.emit(core, "TokenDeposited")
        .withArgs(wallet.address, token1.address, 45);
    });

    it("Should emit an event on deposit", async function () {
      await expect(core.deposit({ value: 30 }))
        .to.emit(core, "TokenDeposited")
        .withArgs(wallet.address, wrapped.address, 30);
    });

    it("Should emit an event on withdraw", async function () {
      await expect(core.withdrawToken(token1.address, 20))
        .to.emit(core, "TokenWithdrawal")
        .withArgs(wallet.address, token1.address, 20);
    });
  });
});
