import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Bridge } from "../target/types/bridge";

describe("🌉 Manual Bridge Test", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Bridge as Program<Bridge>;

    // Use your actual wallet instead of generating new one
    const wallet = provider.wallet as anchor.Wallet;

    let bridgeState: PublicKey;

    it("🚀 Initialize Bridge", async () => {
        // Derive bridge state PDA
        [bridgeState] = PublicKey.findProgramAddressSync(
            [Buffer.from("bridge_state")],
            program.programId
        );

        console.log("🏗️  Bridge State PDA:", bridgeState.toString());
        console.log("👤 Admin/Wallet:", wallet.publicKey.toString());

        try {
            const tx = await program.methods
                .initialize(wallet.publicKey)
                .accounts({
                    bridgeState,
                    payer: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            console.log("✅ Bridge initialized!");
            console.log("📝 Transaction:", tx);
            console.log("🔗 https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
        } catch (error: any) {
            if (error.message.includes('already in use')) {
                console.log("ℹ️  Bridge already initialized");
            } else {
                console.error("❌ Error:", error.message);
                throw error;
            }
        }
    });

    it("🔒 Lock SOL", async () => {
        const amount = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL
        const destinationAddr = "0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE";

        console.log("🔒 Locking", amount / LAMPORTS_PER_SOL, "SOL");
        console.log("🎯 Destination:", destinationAddr);

        // Get bridge state to find admin
        const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);

        const tx = await program.methods
            .lock(new anchor.BN(amount), destinationAddr)
            .accounts({
                bridgeState,
                user: wallet.publicKey,
                admin: bridgeStateAccount.admin,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log("✅ SOL locked successfully!");
        console.log("📝 Transaction:", tx);
        console.log("🔗 https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
        console.log("🎯 Event emitted - indexer should catch this!");
    });

    it("📊 Check Bridge Status", async () => {
        const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);

        console.log("📊 Bridge Status:");
        console.log("├── Admin:", bridgeStateAccount.admin.toString());
        console.log("├── Total Locked:", bridgeStateAccount.totalLocked.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("└── Bump:", bridgeStateAccount.bump);
    });
}); 