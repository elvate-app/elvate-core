import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber, constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { ElvatePair } from "../typechain/ElvatePair";
import { ElvateSubscription } from "../typechain/ElvateSubscription";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
// let pair: ElvatePair;
// let subscription: ElvateSubscription;
let wrapped: WETH9;
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
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(coreFixture));
    await core.updateContractAddresses(
      constants.AddressZero,
      constants.AddressZero,
      constants.AddressZero,
      wrapped.address
    );
  });

  describe("Deposit token1 by owner", () => {
    it("Should be initialized to zero address", async function () {});
  });
});
