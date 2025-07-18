import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Bridge } from "../target/types/bridge";
import { expect } from "chai";

describe("🌉 Bridge Program Tests", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Bridge as Program<Bridge>;
  const provider = anchor.getProvider();

  // Test accounts
  let admin: Keypair;
  let user: Keypair;
  let bridgeState: PublicKey;
  let bridgeStateBump: number;

  before(async () => {
    // Generate test keypairs
    admin = Keypair.generate();
    user = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(admin.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Derive bridge state PDA
    [bridgeState, bridgeStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("bridge_state")],
      program.programId
    );

    console.log("🔧 Test Setup Complete");
    console.log("├── Admin:", admin.publicKey.toString());
    console.log("├── User:", user.publicKey.toString());
    console.log("└── Bridge State:", bridgeState.toString());
  });

  describe("🚀 Initialization", () => {
    it("Should initialize the bridge state", async () => {
      const tx = await program.methods
        .initialize(admin.publicKey)
        .accounts({
          bridgeState,
          payer: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      console.log("✅ Initialize transaction:", tx);

      // Verify bridge state
      const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
      expect(bridgeStateAccount.admin.toString()).to.equal(admin.publicKey.toString());
      expect(bridgeStateAccount.totalLocked.toNumber()).to.equal(0);
      expect(bridgeStateAccount.bump).to.equal(bridgeStateBump);
    });

    it("Should fail to initialize if already initialized", async () => {
      try {
        await program.methods
          .initialize(admin.publicKey)
          .accounts({
            bridgeState,
            payer: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("already in use");
      }
    });
  });

  describe("🔒 Lock Function", () => {
    it("Should successfully lock SOL and emit event", async () => {
      const lockAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
      const destinationAddress = "0x742d35Cc6634C0532925a3b8D2B5B0F663d3aD56";

      // Get initial balances
      const initialUserBalance = await provider.connection.getBalance(user.publicKey);
      const initialAdminBalance = await provider.connection.getBalance(admin.publicKey);
      const initialBridgeState = await program.account.bridgeState.fetch(bridgeState);

      // Set up event listener
      let eventFired = false;
      let eventData: any;

      const listener = program.addEventListener("LockEvent", (event) => {
        eventFired = true;
        eventData = event;
        console.log("🎉 Event received:", event);
      });

      try {
        const tx = await program.methods
          .lock(new anchor.BN(lockAmount), destinationAddress)
          .accounts({
            bridgeState,
            user: user.publicKey,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        console.log("✅ Lock transaction:", tx);

        // Wait for event
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify balances changed
        const finalUserBalance = await provider.connection.getBalance(user.publicKey);
        const finalAdminBalance = await provider.connection.getBalance(admin.publicKey);
        const finalBridgeState = await program.account.bridgeState.fetch(bridgeState);

        // User should have less SOL (amount + fees)
        expect(finalUserBalance).to.be.lessThan(initialUserBalance - lockAmount);

        // Admin should have more SOL
        expect(finalAdminBalance).to.equal(initialAdminBalance + lockAmount);

        // Bridge state should be updated
        expect(finalBridgeState.totalLocked.toNumber()).to.equal(
          initialBridgeState.totalLocked.toNumber() + lockAmount
        );

        // Verify event was emitted
        expect(eventFired).to.be.true;
        expect(eventData.sourceAddress.toString()).to.equal(user.publicKey.toString());
        expect(eventData.destinationAddress).to.equal(destinationAddress);
        expect(eventData.amount.toNumber()).to.equal(lockAmount);

      } finally {
        program.removeEventListener(listener);
      }
    });

    it("Should fail with invalid amount (zero)", async () => {
      const destinationAddress = "0x742d35Cc6634C0532925a3b8D2B5B0F663d3aD56";

      try {
        await program.methods
          .lock(new anchor.BN(0), destinationAddress)
          .accounts({
            bridgeState,
            user: user.publicKey,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAmount");
      }
    });

    it("Should fail with amount too large", async () => {
      const largeAmount = 2 * LAMPORTS_PER_SOL; // 2 SOL (exceeds 1 SOL limit)
      const destinationAddress = "0x742d35Cc6634C0532925a3b8D2B5B0F663d3aD56";

      try {
        await program.methods
          .lock(new anchor.BN(largeAmount), destinationAddress)
          .accounts({
            bridgeState,
            user: user.publicKey,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("AmountTooLarge");
      }
    });

    it("Should fail with invalid destination address", async () => {
      const lockAmount = 0.1 * LAMPORTS_PER_SOL;
      const invalidAddress = "invalid_address";

      try {
        await program.methods
          .lock(new anchor.BN(lockAmount), invalidAddress)
          .accounts({
            bridgeState,
            user: user.publicKey,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidDestinationAddress");
      }
    });

    it("Should fail with wrong admin account", async () => {
      const lockAmount = 0.1 * LAMPORTS_PER_SOL;
      const destinationAddress = "0x742d35Cc6634C0532925a3b8D2B5B0F663d3aD56";
      const wrongAdmin = Keypair.generate();

      try {
        await program.methods
          .lock(new anchor.BN(lockAmount), destinationAddress)
          .accounts({
            bridgeState,
            user: user.publicKey,
            admin: wrongAdmin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAdmin");
      }
    });
  });

  describe("🔧 Admin Functions", () => {
    it("Should allow admin to update admin authority", async () => {
      const newAdmin = Keypair.generate();

      const tx = await program.methods
        .updateAdmin(newAdmin.publicKey)
        .accounts({
          bridgeState,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      console.log("✅ Update admin transaction:", tx);

      // Verify admin was updated
      const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
      expect(bridgeStateAccount.admin.toString()).to.equal(newAdmin.publicKey.toString());

      // Update admin keypair for subsequent tests
      admin = newAdmin;
    });

    it("Should fail to update admin with wrong authority", async () => {
      const wrongAdmin = Keypair.generate();
      const newAdmin = Keypair.generate();

      try {
        await program.methods
          .updateAdmin(newAdmin.publicKey)
          .accounts({
            bridgeState,
            admin: wrongAdmin.publicKey,
          })
          .signers([wrongAdmin])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.toString()).to.include("InvalidAdmin");
      }
    });
  });

  describe("📊 State Verification", () => {
    it("Should have correct bridge state after operations", async () => {
      const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);

      console.log("📊 Final Bridge State:");
      console.log("├── Admin:", bridgeStateAccount.admin.toString());
      console.log("├── Total Locked:", bridgeStateAccount.totalLocked.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("└── Bump:", bridgeStateAccount.bump);

      expect(bridgeStateAccount.totalLocked.toNumber()).to.be.greaterThan(0);
      expect(bridgeStateAccount.bump).to.equal(bridgeStateBump);
    });
  });
});
