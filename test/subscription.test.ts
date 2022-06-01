import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvatePair } from "../typechain/ElvatePair";
import { ElvateSubscription } from "../typechain/ElvateSubscription";
import { TestERC20 } from "../typechain/TestERC20";
import {
  pairFixture,
  subscriptionFixture,
  tokenFixture,
} from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
let pair: ElvatePair;
let subscription: ElvateSubscription;
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

  before("Init pair contract", async () => {
    ({ pair } = await loadFixture(pairFixture));
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    await pair.createPair(token0.address, token1.address);
    await pair.createPair(token1.address, token0.address);
    await pair.createPair(token2.address, token0.address);
  });

  beforeEach("deploy fixture", async () => {
    ({ subscription } = await loadFixture(subscriptionFixture));
  });

  describe("ElvatePairAddress", () => {
    it("Should be initialized to zero address", async function () {
      expect(await subscription.elvatePairAddress()).to.eq(
        constants.AddressZero
      );
    });

    it("Should modify ElvatePair address correctly with AddressZero", async function () {
      await subscription.updateElvatePairAddress(constants.AddressZero);
      expect(await subscription.elvatePairAddress()).to.eq(
        constants.AddressZero
      );
    });

    it("Should modify ElvatePair address correctly with ElvatePair address", async function () {
      await subscription.updateElvatePairAddress(pair.address);
      expect(await subscription.elvatePairAddress()).to.eq(pair.address);
    });

    it("Should failed on other user", async function () {
      await expect(
        subscription
          .connect(other)
          .updateElvatePairAddress(constants.AddressZero)
      ).to.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Subscribe", () => {
    it("Should create subscription to first pair with owner", async function () {
      await subscription.subscribe(token0.address, token1.address, 10);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(1);
      expect(allSubscriptions[0].amountIn).to.eq(10);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should create subscription to an other existing pair with owner", async function () {
      await subscription.subscribe(token1.address, token0.address, 20);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(2);
      expect(allSubscriptions[1].amountIn).to.eq(20);
      expect(allSubscriptions[1].owner).to.eq(wallet.address);
      expect(allSubscriptions[1].pairId).to.eq(2);
    });

    it("Should create subscription to first pair with other", async function () {
      await subscription
        .connect(other)
        .subscribe(token1.address, token0.address, 30);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[2].amountIn).to.eq(30);
      expect(allSubscriptions[2].owner).to.eq(other.address);
      expect(allSubscriptions[2].pairId).to.eq(2);
    });

    it("Should edit subscription to first pair with owner", async function () {
      await subscription.subscribe(token0.address, token1.address, 30);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(30);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with 0", async function () {
      await subscription.subscribe(token0.address, token1.address, 0);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(0);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with max value", async function () {
      await subscription.subscribe(
        token0.address,
        token1.address,
        constants.MaxUint256
      );
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[0].amountIn).to.eq(constants.MaxUint256);
      expect(allSubscriptions[0].owner).to.eq(wallet.address);
      expect(allSubscriptions[0].pairId).to.eq(1);
    });

    it("Should edit subscription with other", async function () {
      await subscription
        .connect(other)
        .subscribe(token1.address, token0.address, 10);
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
      expect(allSubscriptions[2].amountIn).to.eq(10);
      expect(allSubscriptions[2].owner).to.eq(other.address);
      expect(allSubscriptions[2].pairId).to.eq(2);
    });

    it("Should revert with invalid pair", async function () {
      await expect(
        subscription.subscribe(token0.address, token2.address, 10)
      ).to.revertedWith("Invalid pair");
      const allSubscriptions = await subscription.getAllSubscriptions();
      expect(allSubscriptions.length).to.eq(3);
    });
  });
});
