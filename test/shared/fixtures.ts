import { BigNumber, Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import { ElvateCore } from "../../typechain/ElvateCore";
import { TestERC20 } from "../../typechain/TestERC20";
import { WETH9 } from "../../typechain/WETH9";
import { ISwapRouter } from "../../typechain/ISwapRouter"
import { MockContract } from "ethereum-waffle";

const deployMockContract = waffle.deployMockContract;

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

interface WrappedFixture {
  wrapped: WETH9;
}

export async function wrappedFixture(): Promise<WrappedFixture> {
  const factory = await ethers.getContractFactory("WETH9");
  const wrapped = (await factory.deploy()) as WETH9;

  return { wrapped };
}

interface routerFixture {
  router: MockContract
}

export async function routerFixture(signer: Signer): Promise<any> {
  const router = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
  const mockedRouter = await deployMockContract(signer, router.abi);

  return {router: mockedRouter}
}
