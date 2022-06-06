import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { constants, Wallet } from "ethers";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { ElvateCore } from "../typechain/ElvateCore";
import { TestERC20 } from "../typechain/TestERC20";
import { WETH9 } from "../typechain/WETH9";
import { coreFixture, tokenFixture, wrappedFixture } from "./shared/fixtures";

let wallet: Wallet;
let other: Wallet;
let wrapped: WETH9;
let core: ElvateCore;
let token0: TestERC20;
let token1: TestERC20;
let token2: TestERC20;
let loadFixture: ReturnType<typeof createFixtureLoader>;

describe("Elvate Chest", function () {
  before("create fixtures", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
    ({ token0, token1, token2 } = await loadFixture(tokenFixture));
    ({ wrapped } = await loadFixture(wrappedFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ core } = await loadFixture(() => coreFixture(constants.AddressZero, wrapped.address)));
  });

  it("return 0 deposit for owner", async () => {
    [token0, token1, token2].forEach(async (token) => {
      expect(await core.depositByOwnerByToken(wallet.address, token.address)).to.eq(0);
    });
  });

  it("return 0 deposit for other", async () => {
    [token0, token1, token2].forEach(async (token) => {
      expect(await core.depositByOwnerByToken(other.address, token.address)).to.eq(0);
    });
  });

  describe("Deposit token with owner", () => {
    beforeEach("Initialize allowance", async () => {
      for (const token of [token0, token1, token2]) {
        await token.approve(core.address, 1000000);
      }
    });

    describe("First deposit with owner", () => {
      for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
        it(`return correct value for first ${amount} deposit with token0`, async () => {
          await core.depositToken(token0.address, amount);
          expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(amount);

          // other are set to 0
          expect(await core.depositByOwnerByToken(other.address, token0.address)).to.eq(0);

          for (const token of [token1, token2]) {
            expect(await core.depositByOwnerByToken(wallet.address, token.address)).to.eq(0);
            expect(await core.depositByOwnerByToken(other.address, token.address)).to.eq(0);
          }
        });
      }

      it("revert with insufficient allowance with token0", async () => {
        await expect(core.depositToken(token0.address, 1000001)).to.revertedWith("ERC20: insufficient allowance");
      });

      it("revert with insufficient balance with token0", async () => {
        await token0.approve(core.address, constants.MaxUint256);
        const balance = await token0.balanceOf(wallet.address);
        await expect(core.depositToken(token0.address, balance.add(1))).to.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });

      for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
        it(`return correct value for first ${amount} deposit with token1`, async () => {
          await core.depositToken(token1.address, amount);
          expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(amount);

          // other are set to 0
          expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(0);

          for (const token of [token0, token2]) {
            expect(await core.depositByOwnerByToken(wallet.address, token.address)).to.eq(0);
            expect(await core.depositByOwnerByToken(other.address, token.address)).to.eq(0);
          }
        });
      }

      it("revert with insufficient allowance with token1", async () => {
        await expect(core.depositToken(token1.address, 1000001)).to.revertedWith("ERC20: insufficient allowance");
      });

      it("revert with insufficient balance with token1", async () => {
        await token1.approve(core.address, constants.MaxUint256);
        const balance = await token1.balanceOf(wallet.address);
        await expect(core.depositToken(token1.address, balance.add(1))).to.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });

      it("emit an event on deposit", async () => {
        await expect(core.depositToken(token1.address, 3000))
          .to.emit(core, "TokenDeposited")
          .withArgs(wallet.address, token1.address, 3000);
      });
    });

    describe("Multiple deposit with owner", () => {
      beforeEach("Deposit one time", async () => {
        await core.depositToken(token1.address, 100000);
      });

      for (const amount of [0, 1, 5, 500, 1000, 900000]) {
        it(`return correct value for ${amount} deposit with initial deposit`, async () => {
          await core.depositToken(token1.address, amount);
          expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(amount + 100000);
          expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(0);
        });
      }

      it("revert with insufficient allowance with token1", async () => {
        await expect(core.depositToken(token1.address, 1000000)).to.revertedWith("ERC20: insufficient allowance");
      });

      it("revert with insufficient balance with token1", async () => {
        await token1.approve(core.address, constants.MaxUint256);
        const balance = await token0.balanceOf(wallet.address);
        await expect(core.depositToken(token1.address, balance.add(1))).to.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });
    });
  });

  describe("Withdraw token with owner", () => {
    beforeEach("Initialize deposit", async () => {
      for (const token of [token0, token1, token2]) {
        await token.approve(core.address, 1000000);
      }

      await core.depositToken(token0.address, 5000);
      await core.depositToken(token1.address, 1000000);
    });

    for (const amount of [0, 10, 500, 5000]) {
      it(`return correct value after withdrawing ${amount} of token0`, async () => {
        await core.withdrawToken(token0.address, amount);
        expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(5000 - amount);
        expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(1000000);
      });
    }

    for (const amount of [0, 10, 500, 5000]) {
      it(`return correct value after withdrawing ${amount} of token1`, async () => {
        await core.withdrawToken(token1.address, amount);
        expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(1000000 - amount);
        expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(5000);
      });
    }

    it("revert with insufficient deposit for token0", async () => {
      await expect(core.withdrawToken(token0.address, 5000 + 1)).to.revertedWith("Not enought deposit");
    });

    it("revert with insufficient deposit for token1", async () => {
      await expect(core.withdrawToken(token1.address, 1000000 + 1)).to.revertedWith("Not enought deposit");
    });

    it("emit an event on withdrawal", async () => {
      await expect(core.withdrawToken(token1.address, 3000))
        .to.emit(core, "TokenWithdrawal")
        .withArgs(wallet.address, token1.address, 3000);
    });
  });

  describe("Deposit wrapped", () => {
    for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
      it(`return correct value for ${amount} deposit`, async () => {
        await core.deposit({ value: amount });
        expect(await core.depositByOwnerByToken(wallet.address, wrapped.address)).to.eq(amount);
      });
    }

    for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
      it(`return correct value for ${amount} deposit with initial deposit`, async () => {
        await core.deposit({ value: 1000 });
        await core.deposit({ value: amount });
        expect(await core.depositByOwnerByToken(wallet.address, wrapped.address)).to.eq(1000 + amount);
      });
    }
  });

  describe("Other user", () => {
    beforeEach("Init deposit with owner, other wallet", async () => {
      for (const token of [token0, token1, token2]) {
        await token.approve(core.address, 1000000);
        token.transfer(other.address, 1000000);
        await token.connect(other).approve(core.address, 1000000);
      }

      await core.depositToken(token0.address, 500);
      await core.depositToken(token1.address, 1500);
      await core.depositToken(token2.address, 3500);
    });

    describe("Deposit with other", () => {
      it("return correct value for deposit token0", async () => {
        await core.connect(other).depositToken(token0.address, 50);
        expect(await core.depositByOwnerByToken(other.address, token0.address)).to.eq(50);
        expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(500);

        for (const token of [token1, token2]) {
          expect(await core.depositByOwnerByToken(other.address, token.address)).to.eq(0);
        }
      });

      it("return correct value for deposit token1", async () => {
        await core.connect(other).depositToken(token1.address, 3000);
        expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(3000);
        expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(1500);

        for (const token of [token0, token2]) {
          expect(await core.depositByOwnerByToken(other.address, token.address)).to.eq(0);
        }
      });

      it("emit an event on deposit", async () => {
        await expect(core.connect(other).depositToken(token1.address, 3000))
          .to.emit(core, "TokenDeposited")
          .withArgs(other.address, token1.address, 3000);
      });
    });

    describe("Withdraw with other", () => {
      beforeEach("Init deposit with other", async () => {
        await core.connect(other).depositToken(token0.address, 1000000);
        await core.connect(other).depositToken(token1.address, 6432);
      });

      it("return correct value for deposit token0", async () => {
        await core.connect(other).withdrawToken(token0.address, 50000);
        expect(await core.depositByOwnerByToken(other.address, token0.address)).to.eq(1000000 - 50000);
        expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(6432);
        expect(await core.depositByOwnerByToken(other.address, token2.address)).to.eq(0);

        // owner
        expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(500);
        expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(1500);
        expect(await core.depositByOwnerByToken(wallet.address, token2.address)).to.eq(3500);
      });

      it("return correct value for deposit token1", async () => {
        await core.connect(other).withdrawToken(token1.address, 5000);
        expect(await core.depositByOwnerByToken(other.address, token1.address)).to.eq(6432 - 5000);
        expect(await core.depositByOwnerByToken(other.address, token0.address)).to.eq(1000000);
        expect(await core.depositByOwnerByToken(other.address, token2.address)).to.eq(0);

        // owner
        expect(await core.depositByOwnerByToken(wallet.address, token0.address)).to.eq(500);
        expect(await core.depositByOwnerByToken(wallet.address, token1.address)).to.eq(1500);
        expect(await core.depositByOwnerByToken(wallet.address, token2.address)).to.eq(3500);
      });

      it("emit an event on withdraw", async () => {
        await expect(core.connect(other).withdrawToken(token1.address, 5000))
          .to.emit(core, "TokenWithdrawal")
          .withArgs(other.address, token1.address, 5000);
      });
    });

    describe("Deposit wrapped with other", () => {
      for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
        it(`return correct value for ${amount} deposit`, async () => {
          await core.connect(other).deposit({ value: amount });
          expect(await core.depositByOwnerByToken(other.address, wrapped.address)).to.eq(amount);
          expect(await core.depositByOwnerByToken(wallet.address, wrapped.address)).to.eq(0);
        });
      }

      for (const amount of [0, 1, 5, 500, 1000, 1000000]) {
        it(`return correct value for ${amount} deposit with initial deposit`, async () => {
          await core.connect(other).deposit({ value: 1000 });
          await core.connect(other).deposit({ value: amount });
          expect(await core.depositByOwnerByToken(other.address, wrapped.address)).to.eq(1000 + amount);
          expect(await core.depositByOwnerByToken(wallet.address, wrapped.address)).to.eq(0);
        });
      }
    });
  });
});
