const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const PROGRAM_ID = '6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
    console.log('🌉 Bridge Testing Script');
    console.log('========================');

    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load wallet keypair
    const walletPath = path.join(require('os').homedir(), '.config', 'solana', 'id.json');
    let wallet;

    try {
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        console.log('✅ Wallet loaded:', wallet.publicKey.toString());
    } catch (error) {
        console.error('❌ Failed to load wallet from:', walletPath);
        console.error('Make sure you have a Solana keypair at the default location');
        return;
    }

    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('💰 Wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL');

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log('🪂 Low balance, requesting airdrop...');
        try {
            const signature = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(signature);
            console.log('✅ Airdrop successful');
        } catch (error) {
            console.error('❌ Airdrop failed:', error.message);
        }
    }

    // Load program IDL
    const programId = new PublicKey(PROGRAM_ID);
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
    anchor.setProvider(provider);

    // Load program using workspace or IDL
    let program;

    try {
        // Try to load from workspace first (easier)
        if (anchor.workspace && anchor.workspace.Bridge) {
            program = anchor.workspace.Bridge;
            console.log('✅ Program loaded from workspace');
        } else {
            // Fallback to manual IDL loading
            const idlPath = './target/idl/bridge.json';
            console.log('🔍 Loading IDL manually from:', idlPath);

            if (!fs.existsSync(idlPath)) {
                console.error('❌ IDL file not found at:', idlPath);
                console.error('Run: anchor build');
                return;
            }

            const idl = require(path.resolve(idlPath));
            program = new anchor.Program(idl, provider);
            console.log('✅ Program loaded from IDL');
        }
    } catch (error) {
        console.error('❌ Failed to load program:', error.message);
        console.error('Try running from the bridge directory with: anchor build');
        return;
    }

    // Derive bridge state PDA
    const [bridgeState, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('bridge_state')],
        programId
    );
    console.log('🏗️  Bridge State PDA:', bridgeState.toString());

    const command = process.argv[2];

    if (command === 'init') {
        console.log('\n🚀 Initializing Bridge...');

        try {
            const tx = await program.methods
                .initialize(wallet.publicKey)
                .accounts({
                    bridgeState,
                    payer: wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([wallet])
                .rpc();

            console.log('✅ Bridge initialized!');
            console.log('📝 Transaction:', tx);
            console.log('🔗 View on Solana Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('ℹ️  Bridge already initialized');
            } else {
                console.error('❌ Initialization failed:', error.message);
            }
        }

    } else if (command === 'lock') {
        const amountStr = process.argv[3];
        const destinationAddr = process.argv[4];

        if (!amountStr || !destinationAddr) {
            console.log('Usage: node test-bridge.js lock <amount_in_sol> <evm_address>');
            console.log('Example: node test-bridge.js lock 0.1 0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE');
            return;
        }

        const amount = Math.floor(parseFloat(amountStr) * LAMPORTS_PER_SOL);

        console.log('\n🔒 Locking SOL...');
        console.log('├── Amount:', amount / LAMPORTS_PER_SOL, 'SOL');
        console.log('└── Destination:', destinationAddr);

        try {
            // Get bridge state to find admin
            const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
            const admin = bridgeStateAccount.admin;

            const tx = await program.methods
                .lock(new anchor.BN(amount), destinationAddr)
                .accounts({
                    bridgeState,
                    user: wallet.publicKey,
                    admin: admin,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([wallet])
                .rpc();

            console.log('✅ SOL locked successfully!');
            console.log('📝 Transaction:', tx);
            console.log('🔗 View on Solana Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
            console.log('🎯 Event emitted - indexer should pick this up and release tokens on EVM');
        } catch (error) {
            console.error('❌ Lock failed:', error.message);
        }

    } else if (command === 'status') {
        console.log('\n📊 Bridge Status...');

        try {
            const bridgeStateAccount = await program.account.bridgeState.fetch(bridgeState);
            console.log('├── Admin:', bridgeStateAccount.admin.toString());
            console.log('├── Total Locked:', bridgeStateAccount.totalLocked.toNumber() / LAMPORTS_PER_SOL, 'SOL');
            console.log('└── Bump:', bridgeStateAccount.bump);
        } catch (error) {
            console.log('❌ Bridge not initialized yet');
        }

    } else {
        console.log('\n📋 Available Commands:');
        console.log('├── init                    - Initialize the bridge');
        console.log('├── lock <amount> <address> - Lock SOL and emit event');
        console.log('└── status                  - Check bridge status');
        console.log('\nExamples:');
        console.log('node test-bridge.js init');
        console.log('node test-bridge.js lock 0.1 0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE');
        console.log('node test-bridge.js status');
    }
}

main().catch(console.error); 