import { expect } from "chai";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { beforeEach } from "mocha";
import { TestElvateCore } from "../typechain/TestElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { testCoreFixture, tokenFixture } from "./shared/fixtures";

const createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let testCore: TestElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

let fees: BigNumber;

describe("Elvate Pair", function () {
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ testCore } = await loadFixture(() =>
      testCoreFixture(constants.AddressZero, constants.AddressZero)
    ));
  });

  describe("Fees", () => {
    it("Should be initialized to 0.1 ether", async function () {
      expect(await testCore.fees()).to.eq(ethers.utils.parseEther("0.1"));
    });

    it("Should disable the fees", async function () {
      await testCore.updateFees(0);
      expect(await testCore.fees()).to.eq(0);
    });

    it("Should update the fees at max value", async function () {
      await testCore.updateFees("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      expect(await testCore.fees()).to.eq("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    });

    it("Should update the fees with custom value", async function () {
      await testCore.updateFees(ethers.utils.parseEther("0.1"));
      expect(await testCore.fees()).to.eq(ethers.utils.parseEther("0.1"));
    });

    it("Should failed on other user", async function () {
      await expect(testCore.connect(other).updateFees(0)).to.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Pairs", () => {
    before("Initialize fees", async () => {
      fees = await testCore.fees();
    });

    describe("Pair Creation", () => {
      it("Should create a testCore without fees for owner", async function () {
        await testCore.createPair(token0.address, token1.address);
        const allPairs = await testCore.getAllPairs();
        expect(allPairs.length).to.eq(1);
        expect(allPairs[0].id).to.eq(1);
        expect(allPairs[0].tokenIn).to.eq(token0.address);
        expect(allPairs[0].tokenOut).to.eq(token1.address);
        expect(allPairs[0].lastPaidAt).to.eq(1);
      });

      it("Should create a testCore with different user with right fees", async function () {
        await testCore
          .connect(other)
          .createPair(token1.address, token2.address, {
            value: fees,
          });
        const allPairs = await testCore.getAllPairs();
        expect(allPairs.length).to.eq(2);
        expect(allPairs[0].id).to.eq(1);
        expect(allPairs[0].tokenIn).to.eq(token0.address);
        expect(allPairs[0].tokenOut).to.eq(token1.address);
        expect(allPairs[0].lastPaidAt).to.eq(1);

        expect(allPairs[1].id).to.eq(2);
        expect(allPairs[1].tokenIn).to.eq(token1.address);
        expect(allPairs[1].tokenOut).to.eq(token2.address);
        expect(allPairs[1].lastPaidAt).to.eq(1);
      });

      it("Should create a reverse testCore with different user with highter fees", async function () {
        await testCore
          .connect(other)
          .createPair(token2.address, token1.address, {
            value: fees.add(ethers.utils.parseEther("2")),
          });
        const allPairs = await testCore.getAllPairs();
        expect(allPairs.length).to.eq(3);

        expect(allPairs[2].id).to.eq(3);
        expect(allPairs[2].tokenIn).to.eq(token2.address);
        expect(allPairs[2].tokenOut).to.eq(token1.address);
        expect(allPairs[2].lastPaidAt).to.eq(1);
      });

      it("Should revert with insufficient fees", async function () {
        await expect(
          testCore.connect(other).createPair(token0.address, token2.address, {
            value: fees.sub(1),
          })
        ).to.revertedWith("Insufficient fees");
      });

      it("Should revert with zero fees", async function () {
        await expect(
          testCore.connect(other).createPair(token0.address, token2.address, {
            value: 0,
          })
        ).to.revertedWith("Insufficient fees");
      });

      it("Should revert with same token", async function () {
        await expect(
          testCore.createPair(token0.address, token0.address)
        ).to.revertedWith("Tokens cannot be identical");
      });

      it("Should revert with existing testCore", async function () {
        await expect(
          testCore.connect(other).createPair(token0.address, token1.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
        await expect(
          testCore.connect(other).createPair(token1.address, token2.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
        await expect(
          testCore.connect(other).createPair(token2.address, token1.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
      });
    });

    describe("Mapping", () => {
      it("Should contains fist testCore", async function () {
        const id = await testCore.pairIdByTokenInOut(
          token0.address,
          token1.address
        );
        expect(id).to.eq(1);
      });

      it("Should contains second testCore", async function () {
        const id = await testCore.pairIdByTokenInOut(
          token1.address,
          token2.address
        );
        expect(id).to.eq(2);
      });

      it("Should contains third testCore", async function () {
        const id = await testCore.pairIdByTokenInOut(
          token2.address,
          token1.address
        );
        expect(id).to.eq(3);
      });

      it("Should not contains non existent testCore", async function () {
        const id = await testCore.pairIdByTokenInOut(
          token0.address,
          token2.address
        );
        expect(id).to.eq(0);
      });
    });

    describe("Trigger", () => {
      it("Should trigger a testCore by owner and update last paid at", async function () {
        const tx = await testCore.trigger(token0.address, token1.address);
        const receipt = await tx.wait();
        const blockNumber = receipt.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        const p = (await testCore.getAllPairs())[0];
        expect(p.lastPaidAt).to.eq(block.timestamp);
      });

      it("Should re trigger a testCore after waiting frequency", async function () {
        let timestamp = (await testCore.getAllPairs())[0].lastPaidAt;
        const frequency = await testCore.frequency();
        await ethers.provider.send("evm_mine", [
          timestamp.add(frequency).toNumber(),
        ]);
        const tx = await testCore.trigger(token0.address, token1.address);
        const receipt = await tx.wait();
        const blockNumber = receipt.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        const p = (await testCore.getAllPairs())[0];
        expect(p.lastPaidAt).to.eq(block.timestamp);
        expect(block.timestamp).to.eq(timestamp.add(frequency).toNumber() + 1);
      });

      it("Should revert when frequency not reached", async function () {
        await expect(
          testCore.trigger(token0.address, token1.address)
        ).to.revertedWith("Unable to trigger right now");
      });

      it("Should revert with non existent testCore", async function () {
        await expect(
          testCore.trigger(token1.address, token0.address)
        ).to.revertedWith("No pair found");
      });
    });

    describe("Events", () => {
      it("Should emit pair creation event", async function () {
        await expect(testCore.createPair(token2.address, token0.address))
          .to.emit(testCore, "PairCreated")
          .withArgs(4, token2.address, token0.address);
      });
    });
  });
});
