import { expect } from "chai";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { ElvatePair } from "../typechain/ElvatePair";
import { ElvateSubscription } from "../typechain/ElvateSubscription";
import { TestElvateCore } from "../typechain/TestElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import {
  coreFixture,
  pairFixture,
  subscriptionFixture,
  testCoreFixture,
  tokenFixture,
  wrappedFixture,
} from "./shared/fixtures";

let createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let pair: ElvatePair;
let subscription: ElvateSubscription;
let wrapped: WETH9;
let core: ElvateCore;
let testCore: TestElvateCore;
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
    ({ wrapped } = await loadFixture(wrappedFixture));
    ({ testCore } = await loadFixture(testCoreFixture));
    ({ core } = await loadFixture(coreFixture));
  });

  beforeEach("deploy fixture", async () => {});

  describe("Swap Path", () => {
    it("Should return correct path of length 3", async function () {
      const path = await testCore.getPath(token0.address, token1.address);
      expect(path.length).to.eq(3);
      expect(path[0]).to.eq(token0.address);
      expect(path[1]).to.eq(constants.AddressZero);
      expect(path[2]).to.eq(token1.address);
    });

    it("Should return correct path of length 3", async function () {
      const path = await testCore.getPath(token2.address, token0.address);
      expect(path.length).to.eq(3);
      expect(path[0]).to.eq(token2.address);
      expect(path[1]).to.eq(constants.AddressZero);
      expect(path[2]).to.eq(token0.address);
    });

    it("Should return correct path of length 2", async function () {
      const path = await testCore.getPath(
        token2.address,
        constants.AddressZero
      );
      expect(path.length).to.eq(2);
      expect(path[0]).to.eq(token2.address);
      expect(path[1]).to.eq(constants.AddressZero);
    });

    it("Should return correct path of length 2", async function () {
      const path = await testCore.getPath(
        constants.AddressZero,
        token0.address
      );
      expect(path.length).to.eq(2);
      expect(path[0]).to.eq(constants.AddressZero);
      expect(path[1]).to.eq(token0.address);
    });
  });

  describe("Distribute swap", () => {
    describe("One subscription", () => {
      before("Initialize contract funds", async () => {
        await testCore.updateContractAddresses(
          constants.AddressZero,
          pair.address,
          subscription.address,
          wrapped.address
        );
        await pair.createPair(token0.address, token1.address);
        await pair.createPair(token1.address, token2.address);
        await subscription.updateElvatePairAddress(pair.address);
        await token0.approve(testCore.address, constants.MaxUint256);
        await token1.approve(testCore.address, constants.MaxUint256);
        await token2.approve(testCore.address, constants.MaxUint256);
        await testCore.depositToken(token0.address, 200000);
        await testCore.depositToken(token1.address, 200000);
        await testCore.depositToken(token2.address, 200000);
        await testCore.deposit({ value: 200000 });
        await subscription.subscribe(token0.address, token1.address, 200);
        await subscription.subscribe(token1.address, token2.address, 5326);
      });

      it("Should distribute swap with one subscription", async function () {
        const [eligible, totalAmountIn, length] =
          await testCore.getEligibleSubscription(
            token0.address,
            token1.address
          );
        await testCore.distributeSwap(
          token0.address,
          token1.address,
          eligible,
          length,
          totalAmountIn,
          150
        );
        expect(
          await testCore.getDepositedToken(wallet.address, token1.address)
        ).to.eq(200000 + 150);
        expect(
          await testCore.getDepositedToken(wallet.address, token0.address)
        ).to.eq(200000 - 200);
      });

      it("Should distribute swap with one subscription and other pair", async function () {
        const [eligible, totalAmountIn, length] =
          await testCore.getEligibleSubscription(
            token1.address,
            token2.address
          );
        await testCore.distributeSwap(
          token1.address,
          token2.address,
          eligible,
          length,
          totalAmountIn,
          167321
        );
        expect(
          await testCore.getDepositedToken(wallet.address, token2.address)
        ).to.eq(200000 + 167321);
        expect(
          await testCore.getDepositedToken(wallet.address, token1.address)
        ).to.eq(200000 + 150 - 5326);
      });
    });
  });
});
