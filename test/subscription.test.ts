import { expect } from "chai";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { coreFixture, tokenFixture } from "./shared/fixtures";

const createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

let fees: BigNumber;

describe("Elvate Pair", function () {
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  before("Init core contract", async () => {
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ core } = await loadFixture(coreFixture));
    await core.createPair(token0.address, token1.address);
    await core.createPair(token1.address, token0.address);
    await core.createPair(token2.address, token0.address);
  });

  describe("Subscribe", () => {
    it("Should create subscription to first core with owner", async function () {
      await core.subscribe(token0.address, token1.address, 10);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(1);
      expect(allSubscriptions[0].amountIn).to.eq(10);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should create subscription to an other existing core with owner", async function () {
      await core.subscribe(token1.address, token0.address, 20);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(2);
      expect(allSubscriptions[1].amountIn).to.eq(20);
      expect(allSubscriptions[1].owner).to.eq(wallet.address);
      expect(allSubscriptions[1].pairId).to.eq(2);
    });

    it("Should create subscription to first core with other", async function () {
      await core.connect(other).subscribe(token1.address, token0.address, 30);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[2].amountIn).to.eq(30);
      expect(allSubscriptions[2].owner).to.eq(other.address);
      expect(allSubscriptions[2].pairId).to.eq(2);
    });

    it("Should edit subscription to first core with owner", async function () {
      await core.subscribe(token0.address, token1.address, 30);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(30);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with 0", async function () {
      await core.subscribe(token0.address, token1.address, 0);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(0);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with max value", async function () {
      await core.subscribe(
        token0.address,
        token1.address,
        constants.MaxUint256
      );
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(constants.MaxUint256);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with other", async function () {
      await core.connect(other).subscribe(token1.address, token0.address, 10);
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[2].amountIn).to.eq(10);
      expect(allSubscriptions[2].owner).to.eq(other.address);
      expect(allSubscriptions[2].pairId).to.eq(2);
    });

    it("Should revert with invalid pair", async function () {
      await expect(
        core.subscribe(token0.address, token2.address, 10)
      ).to.revertedWith("Invalid pair");
      const allSubscriptions = await core.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
    });
  });
});
