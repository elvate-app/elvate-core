import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { ElvateCore } from "../../typechain/ElvateCore";
import { TestElvateCore } from "../../typechain/TestElvateCore";
import { TestERC20 } from "../../typechain/TestERC20";
import { WETH9 } from "../../typechain/WETH9";

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

interface ElvateCoreFixture {
  core: ElvateCore;
}

export async function coreFixture(
  router: string,
  wrapped: string
): Promise<ElvateCoreFixture> {
  const factory = await ethers.getContractFactory("ElvateCore");
  const core = (await factory.deploy(router, wrapped)) as ElvateCore;

  return { core };
}

interface TestElvateCoreFixture {
  testCore: TestElvateCore;
}

export async function testCoreFixture(
  router: string,
  wrapped: string
): Promise<TestElvateCoreFixture> {
  const factory = await ethers.getContractFactory("TestElvateCore");
  const testCore = (await factory.deploy(router, wrapped)) as TestElvateCore;

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
  core: ElvateCore;
  testCore: TestElvateCore;
  wrapped: WETH9;
}

export async function allFixture(router: string): Promise<AllFixture> {
  const { token0, token1, token2 } = await tokenFixture();
  const { wrapped } = await wrappedFixture();
  const { testCore } = await testCoreFixture(router, wrapped.address);
  const { core } = await coreFixture(router, wrapped.address);

  return {
    token0,
    token1,
    token2,
    core,
    testCore,
    wrapped,
  };
}
