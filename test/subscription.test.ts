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

describe("Elvate Subscriptions", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
  });

  describe("Initialisation", () => {
    before("deploy fixture", async () => {
      ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
    });

    it("return correct value of subscription on init", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 1)).to.eq(0);
    });

    it("return correct subscriptions for all pairs on init", async () => {
      const allPairs = await core.getPairs();
      expect(allPairs[0].subs.length).to.eq(0);
      expect(allPairs[1].subs.length).to.eq(0);
      expect(allPairs[2].subs.length).to.eq(0);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });
  });

  describe("Subscribe to a pair", () => {
    before("deploy fixture", async () => {
      ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
    });

    it("emit an event on subscription", async () => {
      await expect(core.subscribe(token0.address, token1.address, 50))
        .to.emit(core, "SubEdited")
        .withArgs(1, wallet.address, 50);
    });

    it("return correct value of subscription", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 1)).to.eq(50);
    });

    it("return correct subscription address for token0, token1", async () => {
      expect((await core.getPairs())[0].subs.length).to.eq(1);
      expect((await core.getPairs())[0].subs[0]).to.eq(wallet.address);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([[BigNumber.from(50), wallet.address]]);
    });

    it("return correct value of subscriptions for non subscribed pairs", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 2)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 3)).to.eq(0);
    });

    it("return no subscriptions for other pairs", async () => {
      expect((await core.getPairs())[1].subs.length).to.eq(0);
      expect((await core.getPairs())[2].subs.length).to.eq(0);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });

    it("revert with no valid pair", async () => {
      await expect(core.unsubscribe(token1.address, token0.address)).to.revertedWith("No pair found");
      await expect(core.unsubscribe(token2.address, token1.address)).to.revertedWith("No pair found");
    });

    it("return correct value of subscription with max value", async () => {
      await core.subscribe(token2.address, token0.address, constants.MaxUint256);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 3)).to.eq(constants.MaxUint256);
    });

    it("revert with 0", async () => {
      await expect(core.subscribe(token1.address, token2.address, 0)).to.revertedWith(
        "Can't subscribe with amount <= 0"
      );
    });
  });

  describe("Edit a subscription to a pair", () => {
    before("deploy fixture", async () => {
      ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
      await core.subscribe(token0.address, token1.address, 100);
    });

    it("emit an event on edit", async () => {
      await expect(core.subscribe(token0.address, token1.address, 200))
        .to.emit(core, "SubEdited")
        .withArgs(1, wallet.address, 200);
    });

    it("return correct value of subscription", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 1)).to.eq(200);
    });

    it("return correct subscription address for token0, token1", async () => {
      expect((await core.getPairs())[0].subs.length).to.eq(1);
      expect((await core.getPairs())[0].subs[0]).to.eq(wallet.address);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([[BigNumber.from(200), wallet.address]]);
    });

    it("return correct value of subscriptions for non subscribed pairs", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 2)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 3)).to.eq(0);
    });

    it("return no subscriptions for other pairs", async () => {
      expect((await core.getPairs())[1].subs.length).to.eq(0);
      expect((await core.getPairs())[2].subs.length).to.eq(0);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });

    it("revert with no valid pair", async () => {
      await expect(core.unsubscribe(token1.address, token0.address)).to.revertedWith("No pair found");
      await expect(core.unsubscribe(token2.address, token1.address)).to.revertedWith("No pair found");
    });
  });

  describe("Remove a subscription", () => {
    before("deploy fixture", async () => {
      ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
      await core.subscribe(token0.address, token1.address, 100);
    });

    it("emit an event on unsubscription", async () => {
      await expect(core.unsubscribe(token0.address, token1.address))
        .to.emit(core, "SubEdited")
        .withArgs(1, wallet.address, 0);
    });

    it("return correct value of subscriptions for non subscribed pairs", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 1)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 2)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 3)).to.eq(0);
    });

    it("return no subscriptions for other pairs", async () => {
      expect((await core.getPairs())[0].subs.length).to.eq(0);
      expect((await core.getPairs())[1].subs.length).to.eq(0);
      expect((await core.getPairs())[2].subs.length).to.eq(0);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });

    it("revert with other pair", async () => {
      await expect(core.unsubscribe(token1.address, token2.address)).to.revertedWith("No subscription found");
      await expect(core.unsubscribe(token2.address, token0.address)).to.revertedWith("No subscription found");
    });

    it("revert with no valid pair", async () => {
      await expect(core.unsubscribe(token1.address, token0.address)).to.revertedWith("No pair found");
      await expect(core.unsubscribe(token2.address, token1.address)).to.revertedWith("No pair found");
    });
  });

  describe("Subscribe with other user", () => {
    beforeEach("deploy fixture", async () => {
      ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
      await core.createPair(token0.address, token1.address);
      await core.createPair(token1.address, token2.address);
      await core.createPair(token2.address, token0.address);
      await core.subscribe(token0.address, token1.address, 100);
      await core.subscribe(token1.address, token2.address, 200);
    });

    afterEach("check owner subscriptions authenticity", async () => {
      expect(await core.subAmountInByOwnerPairId(wallet.address, 1)).to.eq(100);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 2)).to.eq(200);
      expect(await core.subAmountInByOwnerPairId(wallet.address, 3)).to.eq(0);
      expect((await core.getPairs())[0].subs.filter((sub) => sub === wallet.address)).to.exist;
      expect((await core.getPairs())[1].subs.filter((sub) => sub === wallet.address)).to.exist;
      expect((await core.getPairs())[2].subs.filter((sub) => sub === wallet.address)).to.exist;
    });

    it("emit correct event on subscription", async () => {
      await expect(core.connect(other).subscribe(token1.address, token2.address, 10))
        .to.emit(core, "SubEdited")
        .withArgs(2, other.address, 10);
    });

    it("emit correct event on subscription", async () => {
      await expect(core.connect(other).subscribe(token2.address, token0.address, 20))
        .to.emit(core, "SubEdited")
        .withArgs(3, other.address, 20);
    });

    it("emit correct event on edit", async () => {
      await core.connect(other).subscribe(token2.address, token0.address, 20);
      await expect(core.connect(other).subscribe(token2.address, token0.address, 40))
        .to.emit(core, "SubEdited")
        .withArgs(3, other.address, 40);
    });

    it("emit correct event on unsubscription", async () => {
      await core.connect(other).subscribe(token1.address, token2.address, 20);
      await expect(core.connect(other).unsubscribe(token1.address, token2.address))
        .to.emit(core, "SubEdited")
        .withArgs(2, other.address, 0);
    });

    it("return correct value with subscription to token1, token2", async () => {
      await core.connect(other).subscribe(token1.address, token2.address, 20);
      expect(await core.subAmountInByOwnerPairId(other.address, 1)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(other.address, 2)).to.eq(20);
      expect(await core.subAmountInByOwnerPairId(other.address, 3)).to.eq(0);
      expect((await core.getPairs())[0].subs.length).to.eq(1);
      expect((await core.getPairs())[1].subs.length).to.eq(2);
      expect((await core.getPairs())[2].subs.length).to.eq(0);
      expect((await core.getPairs())[1].subs[0]).to.eq(wallet.address);
      expect((await core.getPairs())[1].subs[1]).to.eq(other.address);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([[BigNumber.from(100), wallet.address]]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([
        [BigNumber.from(200), wallet.address],
        [BigNumber.from(20), other.address],
      ]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });

    it("return correct value with subscription to token2, token0", async () => {
      await core.connect(other).subscribe(token2.address, token0.address, 20);
      expect(await core.subAmountInByOwnerPairId(other.address, 1)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(other.address, 2)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(other.address, 3)).to.eq(20);
      expect((await core.getPairs())[0].subs.length).to.eq(1);
      expect((await core.getPairs())[1].subs.length).to.eq(1);
      expect((await core.getPairs())[2].subs.length).to.eq(1);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([[BigNumber.from(100), wallet.address]]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([[BigNumber.from(200), wallet.address]]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([[BigNumber.from(20), other.address]]);
    });

    it("return correct value with unsubscription to token0, token1", async () => {
      await core.connect(other).subscribe(token0.address, token1.address, 20);
      await core.connect(other).unsubscribe(token0.address, token1.address);
      expect(await core.subAmountInByOwnerPairId(other.address, 1)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(other.address, 2)).to.eq(0);
      expect(await core.subAmountInByOwnerPairId(other.address, 3)).to.eq(0);
      expect((await core.getPairs())[0].subs.length).to.eq(1);
      expect((await core.getPairs())[1].subs.length).to.eq(1);
      expect((await core.getPairs())[2].subs.length).to.eq(0);
      expect(await core.getPairSubs(token0.address, token1.address)).to.eql([[BigNumber.from(100), wallet.address]]);
      expect(await core.getPairSubs(token1.address, token2.address)).to.eql([[BigNumber.from(200), wallet.address]]);
      expect(await core.getPairSubs(token2.address, token0.address)).to.eql([]);
    });
  });
});
