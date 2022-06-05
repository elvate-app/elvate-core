import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvatePair } from "../typechain/ElvatePair";
import { TestERC20 } from "../typechain/TestERC20";
import { pairFixture, tokenFixture } from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
let pair: ElvatePair;
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

  beforeEach("deploy fixture", async () => {
    ({ pair } = await loadFixture(pairFixture));
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
  });

  describe("coreContractAddress", () => {
    it("Should be initialized to zero address", async function () {
      expect(await pair.coreContractAddress()).to.eq(constants.AddressZero);
    });

    it("Should modify pair manager correctly", async function () {
      await pair.updateAddress(wallet.address);
      expect(await pair.coreContractAddress()).to.eq(wallet.address);
    });

    it("Should failed on other user", async function () {
      await expect(
        pair.connect(other).updateAddress(pair.address)
      ).to.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Fees", () => {
    it("Should be initialized to 0.1 ether", async function () {
      expect(await pair.fees()).to.eq(ethers.utils.parseEther("0.1"));
    });

    it("Should disable the fees", async function () {
      await pair.updateFees(0);
      expect(await pair.fees()).to.eq(0);
    });

    it("Should update the fees at max value", async function () {
      await pair.updateFees("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      expect(await pair.fees()).to.eq("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    });

    it("Should update the fees with custom value", async function () {
      await pair.updateFees(ethers.utils.parseEther("0.1"));
      expect(await pair.fees()).to.eq(ethers.utils.parseEther("0.1"));
    });

    it("Should failed on other user", async function () {
      await expect(pair.connect(other).updateFees(0)).to.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Pairs", () => {
    before("Initialize fees", async () => {
      fees = await pair.fees();
    });

    describe("Pair Creation", () => {
      it("Should create a pair without fees for owner", async function () {
        await pair.createPair(token0.address, token1.address);
        const allPairs = await pair.getAllPairs();
        expect(allPairs.length).to.eq(1);
        expect(allPairs[0].id).to.eq(1);
        expect(allPairs[0].tokenIn).to.eq(token0.address);
        expect(allPairs[0].tokenOut).to.eq(token1.address);
        expect(allPairs[0].lastPaidAt).to.eq(1);
      });

      it("Should create a pair with different user with right fees", async function () {
        await pair.connect(other).createPair(token1.address, token2.address, {
          value: fees,
        });
        const allPairs = await pair.getAllPairs();
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

      it("Should create a reverse pair with different user with highter fees", async function () {
        await pair.connect(other).createPair(token2.address, token1.address, {
          value: fees.add(ethers.utils.parseEther("2")),
        });
        const allPairs = await pair.getAllPairs();
        expect(allPairs.length).to.eq(3);

        expect(allPairs[2].id).to.eq(3);
        expect(allPairs[2].tokenIn).to.eq(token2.address);
        expect(allPairs[2].tokenOut).to.eq(token1.address);
        expect(allPairs[2].lastPaidAt).to.eq(1);
      });

      it("Should revert with insufficient fees", async function () {
        await expect(
          pair.connect(other).createPair(token0.address, token2.address, {
            value: fees.sub(1),
          })
        ).to.revertedWith("Insufficient fees");
      });

      it("Should revert with zero fees", async function () {
        await expect(
          pair.connect(other).createPair(token0.address, token2.address, {
            value: 0,
          })
        ).to.revertedWith("Insufficient fees");
      });

      it("Should revert with same token", async function () {
        await expect(
          pair.createPair(token0.address, token0.address)
        ).to.revertedWith("Tokens cannot be identical");
      });

      it("Should revert with existing pair", async function () {
        await expect(
          pair.connect(other).createPair(token0.address, token1.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
        await expect(
          pair.connect(other).createPair(token1.address, token2.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
        await expect(
          pair.connect(other).createPair(token2.address, token1.address, {
            value: fees,
          })
        ).to.revertedWith("Pair already exist");
      });
    });

    describe("Mapping", () => {
      it("Should contains fist pair", async function () {
        const id = await pair.pairIdByTokenInOut(
          token0.address,
          token1.address
        );
        expect(id).to.eq(1);
      });

      it("Should contains second pair", async function () {
        const id = await pair.pairIdByTokenInOut(
          token1.address,
          token2.address
        );
        expect(id).to.eq(2);
      });

      it("Should contains third pair", async function () {
        const id = await pair.pairIdByTokenInOut(
          token2.address,
          token1.address
        );
        expect(id).to.eq(3);
      });

      it("Should not contains non existent pair", async function () {
        const id = await pair.pairIdByTokenInOut(
          token0.address,
          token2.address
        );
        expect(id).to.eq(0);
      });
    });

    describe("Trigger", () => {
      it("Should trigger a pair by owner and update last paid at", async function () {
        const tx = await pair.trigger(token0.address, token1.address);
        const receipt = await tx.wait();
        const blockNumber = receipt.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        const p = (await pair.getAllPairs())[0];
        expect(p.lastPaidAt).to.eq(block.timestamp);
      });

      it("Should re trigger a pair after waiting frequency", async function () {
        let timestamp = (await pair.getAllPairs())[0].lastPaidAt;
        const frequency = await pair.frequency();
        await ethers.provider.send("evm_mine", [
          timestamp.add(frequency).toNumber(),
        ]);
        const tx = await pair.trigger(token0.address, token1.address);
        const receipt = await tx.wait();
        const blockNumber = receipt.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        const p = (await pair.getAllPairs())[0];
        expect(p.lastPaidAt).to.eq(block.timestamp);
        expect(block.timestamp).to.eq(timestamp.add(frequency).toNumber() + 1);
      });

      it("Should revert when frequency not reached", async function () {
        await expect(
          pair.trigger(token0.address, token1.address)
        ).to.revertedWith("Unable to trigger right now");
      });

      it("Should revert with non existent pair", async function () {
        await expect(
          pair.trigger(token1.address, token0.address)
        ).to.revertedWith("No pair found");
      });

      it("Should revert with incorrect manager address", async function () {
        await expect(
          pair.connect(other).trigger(token1.address, token2.address)
        ).to.revertedWith("Caller is not the manager");
      });
    });

    describe("Events", () => {
      it("Should emit pair creation event", async function () {
        await expect(pair.createPair(token2.address, token0.address))
          .to.emit(pair, "PairCreated")
          .withArgs(4, token2.address, token0.address);
      });

      it("Should emit trigger event", async function () {
        const tx = await pair.trigger(token2.address, token0.address);
        const receipt = await tx.wait();
        const blockNumber = receipt.blockNumber;
        const block = await ethers.provider.getBlock(blockNumber);
        expect(receipt.events?.length).to.eq(1);
        expect(receipt.events?.[0].args?.pairId).to.eq(4);
        expect(receipt.events?.[0].args?.lastPaidAt).to.eq(block.timestamp);
      });
    });
  });
});
