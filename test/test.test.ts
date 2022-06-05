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

let fees: BigNumber;
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

describe("Elvate Core", function () {
  before("create fixtures", async () => {
    console.log("before");
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
  });

  beforeEach("beforeEach", async () => {
    console.log("beforeEach");
    ({ pair } = await loadFixture(pairFixture));
    pair.createPair(token0.address, token1.address);
  });

  describe("Swap Path", () => {
    it("test 1", async function () {
      console.log("test 1");
      console.log(await pair.getAllPairs());
    });

    it("test 2", async function () {
      console.log("test 2");
      pair.createPair(token1.address, token0.address);
      console.log(await pair.getAllPairs());
    });
  });
});
