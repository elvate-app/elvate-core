import { expect } from "chai";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { ElvateCore } from "../typechain/ElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

const createFixtureLoader = waffle.createFixtureLoader;

let wallet: Wallet;
let other: Wallet;
let wrapped: WETH9;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

describe("Elvate Pairs", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
  });

  describe("Initialisation", () => {
    it("return no pairs", async () => {
      expect(await core.getAllPairs()).to.eql([]);
      await expect(core.allPairs(0)).to.reverted;
    });
  });

  describe("Create Pair", () => {
    it("emit an event on pair creation", async () => {
      expect(await core.createPair(token0.address, token1.address))
        .to.emit(core, "PairCreated")
        .withArgs(1, token0.address, token1.address);
    });

    it("return correct pair with one creation", async () => {
      await core.createPair(token0.address, token1.address);
      expect((await core.getAllPairs())[0]).to.eql([
        BigNumber.from(1),
        BigNumber.from(1),
        token0.address,
        token1.address,
        [],
      ]);
      expect(await core.allPairs(0)).to.eql([BigNumber.from(1), BigNumber.from(1), token0.address, token1.address]);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([]);
    });

    it("return correct pair with multiple creation", async () => {
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
      expect((await core.getAllPairs())[0]).to.eql([
        BigNumber.from(1),
        BigNumber.from(1),
        token0.address,
        token1.address,
        [],
      ]);
      expect((await core.getAllPairs())[1]).to.eql([
        BigNumber.from(2),
        BigNumber.from(1),
        token1.address,
        token2.address,
        [],
      ]);
      expect((await core.getAllPairs())[2]).to.eql([
        BigNumber.from(3),
        BigNumber.from(1),
        token2.address,
        token0.address,
        [],
      ]);
      expect(await core.allPairs(0)).to.eql([BigNumber.from(1), BigNumber.from(1), token0.address, token1.address]);
      expect(await core.allPairs(1)).to.eql([BigNumber.from(2), BigNumber.from(1), token1.address, token2.address]);
      expect(await core.allPairs(2)).to.eql([BigNumber.from(3), BigNumber.from(1), token2.address, token0.address]);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });

    it("revert on already existing pair", async () => {
      await core.createPair(token0.address, token1.address);
      await expect(core.createPair(token0.address, token1.address)).to.revertedWith("Pair already exist");
    });

    it("revert on two same tokens", async () => {
      await expect(core.createPair(token0.address, token0.address)).to.revertedWith("Tokens cannot be identical");
    });

    it("return correct values with other with sufficient fees", async () => {
      const fees = await core.pairCreationFees();
      await core.connect(other).createPair(token0.address, token1.address, { value: fees });
      expect((await core.getAllPairs())[0]).to.eql([
        BigNumber.from(1),
        BigNumber.from(1),
        token0.address,
        token1.address,
        [],
      ]);
    });

    it("return correct values with other with too much fees", async () => {
      const fees = await core.pairCreationFees();
      await core.connect(other).createPair(token0.address, token1.address, { value: fees.add(500) });
      expect((await core.getAllPairs())[0]).to.eql([
        BigNumber.from(1),
        BigNumber.from(1),
        token0.address,
        token1.address,
        [],
      ]);
    });

    it("revert on other without sufficient fees", async () => {
      const fees = await core.pairCreationFees();
      await expect(
        core.connect(other).createPair(token0.address, token1.address, { value: fees.sub(1) })
      ).to.revertedWith("Insufficient fees");
    });

    it("revert on other without fees", async () => {
      const fees = await core.pairCreationFees();
      await expect(
        core.connect(other).createPair(token0.address, token1.address)
      ).to.revertedWith("Insufficient fees");
    });
  });
});
