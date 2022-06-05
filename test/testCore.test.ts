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
import { allFixture, testCoreFixture, tokenFixture } from "./shared/fixtures";

let createFixtureLoader = waffle.createFixtureLoader;

describe("Elvate Core", function () {
  let pair: ElvatePair;
  let wallet: Wallet;
  let other: Wallet;
  let subscription: ElvateSubscription;
  let wrapped: WETH9;
  let core: ElvateCore;
  let testCore: TestElvateCore;
  let token0: TestERC20;
  let token1: TestERC20;
  let token2: TestERC20;
  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
  });

  describe("Swap Path", () => {
    beforeEach("create fixtures", async () => {
      ({ testCore } = await loadFixture(testCoreFixture));
    });

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

  describe("Deduct fees", async () => {
    beforeEach("Create fixture", async () => {
      ({ testCore } = await loadFixture(testCoreFixture));

      for (const token of [token0, token1, token2]) {
        token.transfer(testCore.address, 1000000000);
      }
    });

    for (const val of [0, 1, 10, 1000, 43256, 789271, 9734929, 1000000000]) {
      it("Should keep correct value with " + val, async () => {
        await testCore.connect(other).deductFees(val, token0.address);
        expect(
          await testCore.getDepositedToken(testCore.address, token0.address)
        ).to.eq(
          BigNumber.from(await testCore.swapFee())
            .mul(val)
            .div(10000)
        );
      });

      it("Should transfert correct value with " + val, async () => {
        await testCore.connect(other).deductFees(val, token0.address);
        expect(await token0.balanceOf(other.address)).to.eq(
          BigNumber.from(await testCore.swapFee())
            .mul(val)
            .div(10000)
        );
      });
    }
  });

  describe("Distribute swap", () => {
    beforeEach("init fixture", async () => {
      ({ token0, token1, token2, pair, subscription, core, testCore, wrapped } =
        await loadFixture(allFixture));

      for (const token of [token0, token1, token2]) {
        await token.approve(testCore.address, constants.MaxUint256);
        await testCore.depositToken(token.address, 1000000000);
      }

      await pair.createPair(token0.address, token1.address);
      await pair.createPair(token1.address, token2.address);

      pair.updateAddress(core.address);
      subscription.updateAddress(pair.address);
      testCore.updateContractAddresses(
        constants.AddressZero,
        pair.address,
        subscription.address,
        wrapped.address
      );
    });

    describe("One subscription", () => {
      for (const val of [1, 10, 1000, 43256, 789271, 9734929, 1000000000]) {
        it("Should distribute swap with one subscription", async function () {
          await subscription.subscribe(token0.address, token1.address, val);

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
          ).to.eq(1000000000 + 150);
          expect(
            await testCore.getDepositedToken(wallet.address, token0.address)
          ).to.eq(1000000000 - val);
        });

        it("Should distribute swap with one subscription and other pair", async function () {
          await subscription.subscribe(token0.address, token1.address, 100);
          await subscription.subscribe(token1.address, token2.address, val);

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
          ).to.eq(1000000000 + 167321);
          expect(
            await testCore.getDepositedToken(wallet.address, token1.address)
          ).to.eq(1000000000 - val);
        });
      }
    });

    describe("Multiple subscriptions", () => {
      beforeEach("Init other and subscribe to pair 1", async () => {
        for (const token of [token0, token1, token2]) {
          await token.transfer(other.address, 1000000000);
          await token
            .connect(other)
            .approve(testCore.address, constants.MaxUint256);
          await testCore.connect(other).depositToken(token.address, 1000000000);
        }

        await subscription.subscribe(token0.address, token1.address, 100);
        await subscription
          .connect(other)
          .subscribe(token0.address, token1.address, 300);
      });

      it("Should distribute swap with multiple subscriptions", async function () {
        const precision = await testCore.precision();

        const [eligible, totalAmountIn, length] =
          await testCore.getEligibleSubscription(
            token0.address,
            token1.address
          );
        expect(length).to.eq(2);
        expect(totalAmountIn).to.eq(300 + 100);

        await testCore.distributeSwap(
          token0.address,
          token1.address,
          eligible,
          length,
          totalAmountIn,
          150
        );

        expect(await testCore.getDepositedToken(wallet.address, token1.address))
          .to.eq(
            BigNumber.from(100)
              .mul(precision)
              .div(400)
              .mul(150)
              .div(precision)
              .add(1000000000)
          )
          .to.eq(1000000037);
        expect(
          await testCore.getDepositedToken(wallet.address, token0.address)
        ).to.eq(1000000000 - 100);

        expect(
          await testCore
            .connect(other)
            .getDepositedToken(other.address, token1.address)
        )
          .to.eq(
            BigNumber.from(300)
              .mul(precision)
              .div(400)
              .mul(150)
              .div(precision)
              .add(1000000000)
          )
          .to.eq(1000000112);
        expect(
          await testCore.getDepositedToken(other.address, token0.address)
        ).to.eq(1000000000 - 300);

        expect(
          await testCore.getDepositedToken(testCore.address, token1.address)
        ).to.eq(150 - 37 - 112);
      });

      it("Should distribute swap with multiple subscriptions with other pair", async function () {
        const precision = await testCore.precision();
        await subscription.subscribe(token1.address, token2.address, 536217);
        await subscription
          .connect(other)
          .subscribe(token1.address, token2.address, 5612);

        const [eligible, totalAmountIn, length] =
          await testCore.getEligibleSubscription(
            token1.address,
            token2.address
          );
        expect(length).to.eq(2);
        expect(totalAmountIn).to.eq(536217 + 5612);

        await testCore.distributeSwap(
          token0.address,
          token1.address,
          eligible,
          length,
          totalAmountIn,
          6573479
        );

        expect(await testCore.getDepositedToken(wallet.address, token1.address))
          .to.eq(
            BigNumber.from(536217)
              .mul(precision)
              .div(536217 + 5612)
              .mul(6573479)
              .div(precision)
              .add(1000000000)
          )
          .to.eq(1006505394);
        expect(
          await testCore.getDepositedToken(wallet.address, token0.address)
        ).to.eq(1000000000 - 536217);

        expect(
          await testCore
            .connect(other)
            .getDepositedToken(other.address, token1.address)
        )
          .to.eq(
            BigNumber.from(5612)
              .mul(precision)
              .div(536217 + 5612)
              .mul(6573479)
              .div(precision)
              .add(1000000000)
          )
          .to.eq(1000068084);
        expect(
          await testCore.getDepositedToken(other.address, token0.address)
        ).to.eq(1000000000 - 5612);

        expect(
          await testCore.getDepositedToken(testCore.address, token1.address)
        ).to.eq(6573479 - 68084 - 6505394);
      });
    });
  });
});
