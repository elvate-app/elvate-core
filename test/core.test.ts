import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, routerFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

const createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let wrapped: WETH9;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let router: MockContract;

let loadFixture: ReturnType<typeof createFixtureLoader>;

describe("Elvate Core", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
    ({ router } = await loadFixture(() => routerFixture(wallet)));
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(() => coreFixture(router.address, wrapped.address)));
  });

  it("constructor initialize immutable router contract address", async function () {
    expect(await core.routerContractAddress()).to.eq(router.address);
  });

  it("constructor initialize immutable wrapped contract address", async function () {
    expect(await core.wrappedContractAddress()).to.eq(wrapped.address);
  });

  describe("Eligible subscriptions", () => {
    beforeEach(async () => {
      // create 3 pairs
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);

      // initialize deposit for all tokens
      for (const token of [token0, token1, token2]) {
        await token.transfer(other.address, 10000000);
        await token.approve(core.address, constants.MaxUint256);
        await token.connect(other).approve(core.address, constants.MaxUint256);
        await core.depositToken(token.address, 10000000);
        await core.connect(other).depositToken(token.address, 10000000);
      }
    });

    describe("No subscriptions", () => {
      it("return no subscription for token0, token1", async () => {
        const subs = await core.getEligibleSubs(token0.address, token1.address);
        expect(subs[0].length).to.eq(0);
        expect(subs[1]).to.eq(0);
        expect(subs[2]).to.eq(0);
      });

      it("return no subscription for token1, token2", async () => {
        const subs = await core.getEligibleSubs(token1.address, token2.address);
        expect(subs[0].length).to.eq(0);
        expect(subs[1]).to.eq(0);
        expect(subs[2]).to.eq(0);
      });

      it("return no subscription for token2, token0", async () => {
        const subs = await core.getEligibleSubs(token2.address, token0.address);
        expect(subs[0].length).to.eq(0);
        expect(subs[1]).to.eq(0);
        expect(subs[2]).to.eq(0);
      });

      it("revert for invalid pair", async () => {
        await expect(core.getEligibleSubs(token1.address, token0.address)).to.reverted;
      });
    });

    describe("One subscription to token0, token1", () => {
      beforeEach(async () => {
        await core.connect(other).subscribe(token0.address, token1.address, 50);
      });

      it("return only one subscription for token0, token1", async function () {
        const subs = await core.getEligibleSubs(token0.address, token1.address);
        expect(subs[0].length).to.eq(1);
        expect(subs[0][0]).to.eq(other.address);
        expect(subs[1]).to.eq(50);
        expect(subs[2]).to.eq(1);
      });

      it("return no subscriptions for token1, token2", async function () {
        const subs = await core.getEligibleSubs(token1.address, token2.address);
        expect(subs[0].length).to.eq(0);
        expect(subs[1]).to.eq(0);
        expect(subs[2]).to.eq(0);
      });

      it("return no subscriptions for token2, token0", async function () {
        const subs = await core.getEligibleSubs(token1.address, token2.address);
        expect(subs[0].length).to.eq(0);
        expect(subs[1]).to.eq(0);
        expect(subs[2]).to.eq(0);
      });

      it("revert for invalid pair", async () => {
        await expect(core.getEligibleSubs(token1.address, token0.address)).to.reverted;
      });
    });

    describe("One subscription with max deposit value to token0, token1", () => {
      beforeEach(async () => {
        await core.connect(other).subscribe(token0.address, token1.address, 10000000);
      });

      it("return only one subscription for token0, token1", async function () {
        const subs = await core.getEligibleSubs(token0.address, token1.address);
        expect(subs[0].length).to.eq(1);
        expect(subs[0][0]).to.eq(other.address);
        expect(subs[1]).to.eq(10000000);
        expect(subs[2]).to.eq(1);
      });
    });

    describe("Multiple subscriptions to token0, token1", () => {
      beforeEach(async () => {
        await core.subscribe(token0.address, token1.address, 50);
      });

      describe("With 2 valid subscriptions", () => {
        beforeEach("Subscribe other to token0, token1", async () => {
          await core.connect(other).subscribe(token0.address, token1.address, 180);
        });

        it("return two valid subscriptions to token0, token1", async () => {
          const subs = await core.getEligibleSubs(token0.address, token1.address);
          expect(subs[0].length).to.eq(2);
          expect(subs[0][0]).to.eq(wallet.address);
          expect(subs[0][1]).to.eq(other.address);
          expect(subs[1]).to.eq(230);
          expect(subs[2]).to.eq(2);
        });

        it("return no valid subscriptions to token1, token2", async () => {
          const subs = await core.getEligibleSubs(token1.address, token2.address);
          // 0 Subs for token1, token2
          expect(subs[0].length).to.eq(0);
          expect(subs[1]).to.eq(0);
          expect(subs[2]).to.eq(0);
        });

        it("revert for invalid pair", async () => {
          await expect(core.getEligibleSubs(token1.address, token0.address)).to.revertedWith("No pair found");
        });
      });

      describe("With one valid and one invalid subscriptions", () => {
        beforeEach("Subscribe other to token0, token1", async () => {
          await core.connect(other).subscribe(token0.address, token1.address, 10000001);
        });

        it("return one valid subscriptions to token0, token1", async () => {
          const subs = await core.getEligibleSubs(token0.address, token1.address);
          expect(subs[0].length).to.eq(2);
          expect(subs[0][0]).to.eq(wallet.address);
          expect(subs[0][1]).to.eq(constants.AddressZero);
          expect(subs[1]).to.eq(50);
          expect(subs[2]).to.eq(1);
        });

        it("return no valid subscriptions to token1, token2", async () => {
          const subs = await core.getEligibleSubs(token1.address, token2.address);
          expect(subs[0].length).to.eq(0);
          expect(subs[1]).to.eq(0);
          expect(subs[2]).to.eq(0);
        });

        it("revert for invalid pair", async () => {
          await expect(core.getEligibleSubs(token1.address, token0.address)).to.revertedWith("No pair found");
        });
      });
    });
  });
});
