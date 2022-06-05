import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";
import { ElvateCore } from "../../typechain/ElvateCore";
import { ElvatePair } from "../../typechain/ElvatePair";
import { ElvateSubscription } from "../../typechain/ElvateSubscription";
import { TestElvateCore } from "../../typechain/TestElvateCore";
import { TestERC20 } from "../../typechain/TestERC20";
import { WETH9 } from "../../typechain/WETH9";

interface ElvatePairFixture {
  pair: ElvatePair;
}

export async function pairFixture(): Promise<ElvatePairFixture> {
  const factory = await ethers.getContractFactory("ElvatePair");
  const pair = (await factory.deploy()) as ElvatePair;
  return { pair };
}

interface TokenFixture {
  token0: TestERC20;
  token1: TestERC20;
  token2: TestERC20;
}

export async function tokenFixture(): Promise<TokenFixture> {
  const tokenFactory = await ethers.getContractFactory("TestERC20");
  const tokenA = (await tokenFactory.deploy(
    BigNumber.from(2).pow(255),
    "token0",
    "T0"
  )) as TestERC20;
  const tokenB = (await tokenFactory.deploy(
    BigNumber.from(2).pow(255),
    "token1",
    "T1"
  )) as TestERC20;
  const tokenC = (await tokenFactory.deploy(
    BigNumber.from(2).pow(255),
    "token2",
    "T2"
  )) as TestERC20;

  const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort(
    (tokenA, tokenB) =>
      tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1
  );

  return { token0, token1, token2 };
}

interface ElvateSubscriptionFixture {
  subscription: ElvateSubscription;
}

export async function subscriptionFixture(): Promise<ElvateSubscriptionFixture> {
  const factory = await ethers.getContractFactory("ElvateSubscription");
  const subscription = (await factory.deploy()) as ElvateSubscription;

  return { subscription };
}

interface ElvateCoreFixture {
  core: ElvateCore;
}

export async function coreFixture(): Promise<ElvateCoreFixture> {
  const factory = await ethers.getContractFactory("ElvateCore");
  const core = (await factory.deploy()) as ElvateCore;

  return { core };
}

interface TestElvateCoreFixture {
  testCore: TestElvateCore;
}

export async function testCoreFixture(): Promise<TestElvateCoreFixture> {
  const factory = await ethers.getContractFactory("TestElvateCore");
  const testCore = (await factory.deploy()) as TestElvateCore;

  return { testCore };
}

interface WrappedFixture {
  wrapped: WETH9;
}

export async function wrappedFixture(): Promise<WrappedFixture> {
  const factory = await ethers.getContractFactory("WETH9");
  const wrapped = (await factory.deploy()) as WETH9;

  return { wrapped };
}

interface AllFixture {
  token0: TestERC20;
  token1: TestERC20;
  token2: TestERC20;
  pair: ElvatePair;
  subscription: ElvateSubscription;
  core: ElvateCore;
  testCore: TestElvateCore;
  wrapped: WETH9;
}

export async function allFixture(): Promise<AllFixture> {
  const { token0, token1, token2 } = await tokenFixture();
  const { pair } = await pairFixture();
  const { subscription } = await subscriptionFixture();
  const { wrapped } = await wrappedFixture();
  const { testCore } = await testCoreFixture();
  const { core } = await coreFixture();

  return {
    token0,
    token1,
    token2,
    pair,
    subscription,
    core,
    testCore,
    wrapped,
  };
}
