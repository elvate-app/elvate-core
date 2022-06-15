import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { ISwapRouter } from "../typechain/ISwapRouter";
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

let totalSupply: BigNumber;
let initialBalance: BigNumber;
let initialDeposit: BigNumber;
let precision: BigNumber;
let swapFees: number;

describe("Elvate Core", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ wrapped } = await loadFixture(wrappedFixture));
    ({ router } = await loadFixture(() => routerFixture(wallet)));
  });

  describe("Trigger", () => {
    beforeEach("deploy fixture", async () => {
      initialDeposit = BigNumber.from(10000000);
      ({ token0, token1, token2 } = await loadFixture(tokenFixture));
      ({ core } = await loadFixture(() => coreFixture(router.address, wrapped.address)));
      precision = await core.precision();
      swapFees = await core.swapFees();

      for (const token of [token0, token1, token2]) {
        await token.transfer(core.address, initialDeposit);
        await token.transfer(other.address, initialDeposit);
        await token.approve(core.address, initialDeposit);
        await core.depositToken(token.address, initialDeposit);
        await token.connect(other).approve(core.address, initialDeposit);
        await core.connect(other).depositToken(token.address, initialDeposit);
      }

      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      totalSupply = await token0.totalSupply();
      initialBalance = totalSupply.sub(initialDeposit).sub(initialDeposit).sub(initialDeposit);
    });

    describe("One subscription", () => {
      [
        [1, 1],
        [10000000, 10000000],
        [10000000, 673482],
        [67348, 10000000],
        [6734, 10000000],
        [5643, 78943],
        [784932, 643],
      ].forEach((values: Array<Number>) =>
        it(`trigger a pair with multiple users ${values[0]} -> ${values[1]}`, async () => {
          await core.subscribe(token0.address, token1.address, BigNumber.from(values[0]));
          await router.mock.exactInput.returns(BigNumber.from(values[1]));
          await core.triggerPair(token0.address, token1.address);

          expect(await token0.balanceOf(wallet.address)).to.eq(initialBalance);
          expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(
            initialDeposit.sub(BigNumber.from(values[0]))
          );
          const fees = BigNumber.from(BigNumber.from(values[1])).mul(swapFees).div(10000);
          expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(
            initialDeposit.add(BigNumber.from(values[1])).sub(fees.mul(2))
          );
          expect(await token1.balanceOf(wallet.address)).to.eq(initialBalance.add(fees));
          expect(await core.depositByOwnerByToken(core.address, token1.address)).to.eq(fees);
        })
      );
    });

    describe("multiple subscriptions", () => {
      [
        [1, 1, 1],
        [10000000, 10000000, 10000000],
        [10000000, 67348, 673482],
        [67348, 93429, 10000000],
        [6734, 10000000, 10000000],
        [5643, 66347, 78943],
        [784932, 789432, 643],
        [674382, 67387, 7843],
        [643, 789432, 66347],
      ].forEach((values: Array<Number>) =>
        it(`trigger a pair with multiple users ${values[0]},${values[1]} -> ${values[2]}`, async () => {
          await core.subscribe(token0.address, token1.address, BigNumber.from(values[0]));
          await core.connect(other).subscribe(token0.address, token1.address, BigNumber.from(values[1]));
          await router.mock.exactInput.returns(BigNumber.from(values[2]));
          await core.triggerPair(token0.address, token1.address);
          const fees = BigNumber.from(BigNumber.from(values[2])).mul(swapFees).div(10000);

          expect(await token0.balanceOf(wallet.address)).to.eq(initialBalance);

          expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(
            initialDeposit.sub(BigNumber.from(values[0]))
          );
          expect(await core.depositByOwnerByToken(other.address, token0.address)).to.eq(
            initialDeposit.sub(BigNumber.from(values[1]))
          );

          const totalAmountIn = BigNumber.from(values[0]).add(BigNumber.from(values[1]));
          const totalAmountOut = BigNumber.from(values[2]).sub(fees.mul(2));
          const weight1 = BigNumber.from(values[0]).mul(precision).div(totalAmountIn);
          const amountOut1 = totalAmountOut.mul(weight1).div(precision);
          expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(
            initialDeposit.add(amountOut1)
          );
          const weight2 = BigNumber.from(values[1]).mul(precision).div(totalAmountIn);
          const amountOut2 = totalAmountOut.mul(weight2).div(precision);
          expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(initialDeposit.add(amountOut2));

          const rest = totalAmountOut.sub(amountOut1).sub(amountOut2);

          expect(await token1.balanceOf(wallet.address)).to.eq(initialBalance.add(fees));
          expect(await core.depositByOwnerByToken(core.address, token1.address)).to.eq(fees.add(rest));
        })
      );
    });
  });
});
