import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { ElvatePair } from "../typechain/ElvatePair";
import { ElvateSubscription } from "../typechain/ElvateSubscription";
import { TestERC20 } from "../typechain/TestERC20";
import {
  coreFixture,
  pairFixture,
  subscriptionFixture,
  tokenFixture,
} from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
let pair: ElvatePair;
let subscription: ElvateSubscription;
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
    ({ pair } = await loadFixture(pairFixture));
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ subscription } = await loadFixture(subscriptionFixture));
    await pair.createPair(token0.address, token1.address);
    await pair.createPair(token1.address, token0.address);
    await pair.createPair(token2.address, token0.address);
    await subscription.updateElvatePairAddress(pair.address);
    await subscription.subscribe(token0.address, token1.address, 50);
    await subscription
      .connect(other)
      .subscribe(token0.address, token1.address, 100);
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(coreFixture));
    await pair.updateManagerAddress(core.address);
  });

  describe("Contract addresses", () => {
    it("Should be initialized to zero address", async function () {
      expect(await core.pairContractAddress()).to.eq(constants.AddressZero);
      expect(await core.routerContractAddress()).to.eq(constants.AddressZero);
      expect(await core.subscriptionContractAddress()).to.eq(
        constants.AddressZero
      );
    });

    it("Should modify addresses correctly with AddressZero", async function () {
      await core.updateContractAddresses(
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero,
        constants.AddressZero
      );
      expect(await core.pairContractAddress()).to.eq(constants.AddressZero);
      expect(await core.routerContractAddress()).to.eq(constants.AddressZero);
      expect(await core.subscriptionContractAddress()).to.eq(
        constants.AddressZero
      );
    });

    it("Should modify ElvatePair address correctly with right addresses", async function () {
      await core.updateContractAddresses(
        constants.AddressZero,
        pair.address,
        subscription.address,
        constants.AddressZero
      );
      expect(await core.pairContractAddress()).to.eq(pair.address);
      expect(await core.routerContractAddress()).to.eq(constants.AddressZero);
      expect(await core.subscriptionContractAddress()).to.eq(
        subscription.address
      );
    });

    it("Should failed on other user", async function () {
      await expect(
        core
          .connect(other)
          .updateContractAddresses(
            constants.AddressZero,
            constants.AddressZero,
            constants.AddressZero,
            constants.AddressZero
          )
      ).to.revertedWith("Ownable: caller is not the owner");
    });

    describe("Eligible subscriptions", () => {
      it("Should get all the eligible subscriptions", async function () {
        await core.getEligibleSubscription(token0.address, token1.address);
      });
    });

    describe("Trigger subscriptions", () => {
      it("Should get all the eligible subscriptions", async function () {
        await core.trigger(token0.address, token1.address);
      });
    });
  });
});
