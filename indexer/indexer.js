const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/5kgI7ge-qk3WuMji0QvObz3tnSENzDo7';
const BRIDGE_PROGRAM_ID = '6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5';
const EVM_CONTRACT_ADDRESS = process.env.EVM_CONTRACT_ADDRESS || '0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Enhanced EVM Contract ABI with lock events
const EVM_CONTRACT_ABI = [
    "function release(address to, uint256 amount, bytes32 solanaTxHash) external",
    "function markSepoliaTransactionProcessed(bytes32 sepoliaTxHash) external",
    "event Released(address indexed recipient, uint256 amount, bytes32 indexed solanaTxHash, uint256 timestamp)",
    "event Locked(address indexed from, uint256 amount, string indexed solanaAddress, uint256 timestamp)"
];

class BidirectionalBridgeIndexer {
    constructor() {
        this.solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');
        this.evmProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        this.evmWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, this.evmProvider);
        this.evmContract = new ethers.Contract(EVM_CONTRACT_ADDRESS, EVM_CONTRACT_ABI, this.evmWallet);

        // Track processed transactions
        this.processedSolanaToEvm = new Set();
        this.processedEvmToSolana = new Set();

        // Load Solana admin wallet
        this.loadSolanaWallet();

        console.log('🌉 Bidirectional Bridge Indexer initialized');
        console.log('📡 Solana RPC:', SOLANA_RPC_URL);
        console.log('🔗 Sepolia RPC:', SEPOLIA_RPC_URL);
        console.log('📝 EVM Contract:', EVM_CONTRACT_ADDRESS);
    }

    loadSolanaWallet() {
        try {
            const walletPath = path.join(require('os').homedir(), '.config', 'solana', 'id.json');
            const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            this.solanaWallet = Keypair.fromSecretKey(new Uint8Array(walletData));
            console.log('✅ Solana admin wallet loaded:', this.solanaWallet.publicKey.toString());
        } catch (error) {
            console.error('❌ Failed to load Solana wallet:', error.message);
            process.exit(1);
        }
    }

    async start() {
        console.log('🚀 Starting bidirectional bridge indexer...');

        try {
            await this.testConnections();
            await this.loadSolanaProgram();

            // Start monitoring both chains
            console.log('👂 Starting event monitoring...');
            await Promise.all([
                this.monitorSolanaEvents(),
                this.monitorEvmEvents()
            ]);
        } catch (error) {
            console.error('❌ Failed to start indexer:', error);
            process.exit(1);
        }
    }

    async testConnections() {
        try {
            const solanaVersion = await this.solanaConnection.getVersion();
            console.log('✅ Solana connection successful:', solanaVersion);

            const evmNetwork = await this.evmProvider.getNetwork();
            console.log('✅ EVM connection successful:', evmNetwork.name);

            const balance = await this.evmWallet.provider.getBalance(this.evmWallet.address);
            console.log('💰 Admin wallet balance:', ethers.formatEther(balance), 'ETH');

            const solBalance = await this.solanaConnection.getBalance(this.solanaWallet.publicKey);
            console.log('💰 Solana admin balance:', solBalance / 1e9, 'SOL');
        } catch (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }
    }

    async loadSolanaProgram() {
        try {
            const provider = new anchor.AnchorProvider(
                this.solanaConnection,
                new anchor.Wallet(this.solanaWallet),
                {}
            );
            anchor.setProvider(provider);

            // Load program IDL
            const idlPath = '../target/idl/bridge.json';
            if (!fs.existsSync(idlPath)) {
                throw new Error('IDL file not found. Run: anchor build');
            }

            const idl = require(path.resolve(idlPath));
            this.solanaProgram = new anchor.Program(idl, provider);
            console.log('✅ Solana program loaded');
        } catch (error) {
            throw new Error(`Failed to load Solana program: ${error.message}`);
        }
    }

    // ========== SOLANA → SEPOLIA MONITORING ==========

    async monitorSolanaEvents() {
        console.log('👂 Monitoring Solana lock events (Solana → Sepolia)...');

        const programId = new PublicKey(BRIDGE_PROGRAM_ID);

        this.solanaConnection.onLogs(
            programId,
            async (logs, context) => {
                try {
                    await this.processSolanaLockTransaction(logs.signature);
                } catch (error) {
                    console.error('❌ Error processing Solana transaction:', error);
                }
            },
            'confirmed'
        );

        console.log('🎯 Solana event listener active!');
    }

    async processSolanaLockTransaction(signature) {
        if (this.processedSolanaToEvm.has(signature)) {
            return;
        }

        try {
            console.log('🔍 Processing Solana transaction:', signature);

            const tx = await this.solanaConnection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx) {
                console.log('⚠️  Transaction not found:', signature);
                return;
            }

            const lockEvent = await this.extractSolanaLockEvent(tx);

            if (lockEvent) {
                console.log('🔒 Solana lock event detected:', lockEvent);
                await this.releaseBtkTokens(lockEvent, signature);
                this.processedSolanaToEvm.add(signature);
            }
        } catch (error) {
            console.error('❌ Error processing Solana transaction:', signature, error);
        }
    }

    async extractSolanaLockEvent(tx) {
        try {
            // Look for our lock event in the transaction logs
            if (!tx.meta || !tx.meta.logMessages) return null;

            for (const log of tx.meta.logMessages) {
                if (log.includes('Locked') && log.includes('lamports')) {
                    // Parse the log message
                    const match = log.match(/Locked (\d+) lamports from (\w+) to destination (0x\w+)/);
                    if (match) {
                        return {
                            amount: match[1],
                            sourceAddress: match[2],
                            destinationAddress: match[3]
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error extracting lock event:', error);
            return null;
        }
    }

    async releaseBtkTokens(lockEvent, solanaTxHash) {
        try {
            console.log('🚀 Releasing BTK tokens on Sepolia...');

            // Convert lamports to wei (1:1 ratio)
            const amount = ethers.parseEther((lockEvent.amount / 1e9).toString());

            const tx = await this.evmContract.release(
                lockEvent.destinationAddress,
                amount,
                ethers.id(solanaTxHash) // Convert string to bytes32
            );

            console.log('📝 BTK release transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('✅ BTK tokens released successfully!');
            console.log('🔗 View on Etherscan: https://sepolia.etherscan.io/tx/' + tx.hash);

        } catch (error) {
            console.error('❌ Failed to release BTK tokens:', error.message);
        }
    }

    // ========== SEPOLIA → SOLANA MONITORING ==========

    async monitorEvmEvents() {
        console.log('👂 Monitoring EVM lock events (Sepolia → Solana)...');

        // Listen for Locked events
        this.evmContract.on('Locked', async (from, amount, solanaAddress, timestamp, event) => {
            try {
                await this.processEvmLockEvent({
                    from,
                    amount,
                    solanaAddress,
                    timestamp,
                    txHash: event.transactionHash
                });
            } catch (error) {
                console.error('❌ Error processing EVM lock event:', error);
            }
        });

        console.log('🎯 EVM event listener active!');
    }

    async processEvmLockEvent(lockEvent) {
        if (this.processedEvmToSolana.has(lockEvent.txHash)) {
            return;
        }

        try {
            console.log('🔒 EVM lock event detected:', lockEvent);

            // Convert BTK amount to SOL lamports (1:1 ratio)
            const lamports = Math.floor(parseFloat(ethers.formatEther(lockEvent.amount)) * 1e9);

            await this.releaseSolTokens(lockEvent, lamports);
            this.processedEvmToSolana.add(lockEvent.txHash);

        } catch (error) {
            console.error('❌ Error processing EVM lock event:', error);
        }
    }

    async releaseSolTokens(lockEvent, lamports) {
        try {
            console.log('🚀 Releasing SOL on Solana...');

            // Get bridge state PDA
            const [bridgeState] = PublicKey.findProgramAddressSync(
                [Buffer.from('bridge_state')],
                new PublicKey(BRIDGE_PROGRAM_ID)
            );

            // Get processed transaction PDA
            const [processedTx] = PublicKey.findProgramAddressSync(
                [Buffer.from('processed_tx'), Buffer.from(lockEvent.txHash)],
                new PublicKey(BRIDGE_PROGRAM_ID)
            );

            // Convert Solana address string to PublicKey
            const recipient = new PublicKey(lockEvent.solanaAddress);

            const tx = await this.solanaProgram.methods
                .release(new anchor.BN(lamports), lockEvent.txHash, recipient)
                .accounts({
                    bridgeState,
                    admin: this.solanaWallet.publicKey,
                    recipient: recipient,
                    processedTx: processedTx,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([this.solanaWallet])
                .rpc();

            console.log('✅ SOL released successfully!');
            console.log('📝 Solana transaction:', tx);
            console.log('🔗 View on Solana Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');

            // Mark the EVM transaction as processed
            await this.markEvmTransactionProcessed(lockEvent.txHash);

        } catch (error) {
            console.error('❌ Failed to release SOL:', error.message);
        }
    }

    async markEvmTransactionProcessed(evmTxHash) {
        try {
            const tx = await this.evmContract.markSepoliaTransactionProcessed(
                ethers.id(evmTxHash)
            );
            await tx.wait();
            console.log('✅ EVM transaction marked as processed');
        } catch (error) {
            console.error('❌ Failed to mark EVM transaction as processed:', error.message);
        }
    }

    // ========== UTILITY METHODS ==========

    logStatus() {
        console.log('\n📊 Bridge Status:');
        console.log('├── Processed Solana→EVM:', this.processedSolanaToEvm.size);
        console.log('├── Processed EVM→Solana:', this.processedEvmToSolana.size);
        console.log('└── Uptime:', new Date().toISOString());
    }
}

// Start the indexer
async function main() {
    const indexer = new BidirectionalBridgeIndexer();
    await indexer.start();

    // Log status every 5 minutes
    setInterval(() => {
        indexer.logStatus();
    }, 5 * 60 * 1000);

    console.log('🎉 Bidirectional bridge indexer is running!');
}

main().catch(console.error);