const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey } = require('@solana/web3.js');
const { ethers } = require('ethers');
require('dotenv').config();

// Configuration
const SOLANA_RPC_URL = 'https://api.devnet.solana.com';
const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/5kgI7ge-qk3WuMji0QvObz3tnSENzDo7';
const BRIDGE_PROGRAM_ID = '6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5';
const EVM_CONTRACT_ADDRESS = '0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// EVM Contract ABI (release function)
const EVM_CONTRACT_ABI = [
    "function release(address to, uint256 amount, bytes32 solanaTxHash) external",
    "event Released(address indexed recipient, uint256 amount, bytes32 indexed solanaTxHash, uint256 timestamp)"
];

class BridgeIndexer {
    constructor() {
        this.solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');
        this.evmProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        this.evmWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, this.evmProvider);
        this.evmContract = new ethers.Contract(EVM_CONTRACT_ADDRESS, EVM_CONTRACT_ABI, this.evmWallet);
        this.processedTxs = new Set();

        console.log('🌉 Bridge Indexer initialized');
        console.log('📡 Solana RPC:', SOLANA_RPC_URL);
        console.log('🔗 Sepolia RPC:', SEPOLIA_RPC_URL);
        console.log('📝 EVM Contract:', EVM_CONTRACT_ADDRESS);
    }

    async start() {
        console.log('🚀 Starting bridge indexer...');

        try {
            await this.testConnections();
            await this.monitorSolanaEvents();
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
        } catch (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }
    }

    async monitorSolanaEvents() {
        console.log('👂 Listening for Solana lock events...');

        const programId = new PublicKey(BRIDGE_PROGRAM_ID);

        this.solanaConnection.onLogs(
            programId,
            async (logs, context) => {
                try {
                    await this.processSolanaTransaction(logs.signature);
                } catch (error) {
                    console.error('❌ Error processing transaction:', error);
                }
            },
            'confirmed'
        );

        console.log('🎯 Event listener active!');
    }

    async processSolanaTransaction(signature) {
        if (this.processedTxs.has(signature)) {
            return;
        }

        try {
            console.log('🔍 Processing transaction:', signature);

            const tx = await this.solanaConnection.getTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx) {
                console.log('⚠️  Transaction not found:', signature);
                return;
            }

            const lockEvent = await this.extractLockEvent(tx);

            if (lockEvent) {
                console.log('🔒 Lock event detected:', lockEvent);
                await this.processLockEvent(lockEvent, signature);
                this.processedTxs.add(signature);
            }
        } catch (error) {
            console.error('❌ Error processing Solana transaction:', error);
        }
    }

    async extractLockEvent(transaction) {
        try {
            const programId = new PublicKey(BRIDGE_PROGRAM_ID);
            const accountKeys = transaction.transaction.message.accountKeys ||
                transaction.transaction.message.staticAccountKeys;

            const programInvolved = accountKeys.some(key =>
                key.toString() === programId.toString()
            );

            if (!programInvolved) {
                return null;
            }

            const logs = transaction.meta?.logMessages || [];

            for (const log of logs) {
                if (log.includes('Locked') && log.includes('lamports')) {
                    return this.parseLockLog(log);
                }
            }

            return null;
        } catch (error) {
            console.error('Error extracting lock event:', error);
            return null;
        }
    }

    parseLockLog(logMessage) {
        try {
            // Parse: "Locked 1000000000 lamports from 7xKq...abc to destination 0x742d35Cc6634C0532925a3b8D2B5B0F663d3aD56"
            const regex = /Locked (\d+) lamports from (\w+) to destination (0x[a-fA-F0-9]{40})/;
            const match = logMessage.match(regex);

            if (match) {
                return {
                    amount: match[1],
                    sourceAddress: match[2],
                    destinationAddress: match[3]
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing lock log:', error);
            return null;
        }
    }

    async processLockEvent(lockEvent, txSignature) {
        try {
            console.log('🌉 Processing bridge request...');
            console.log('📍 Source:', lockEvent.sourceAddress);
            console.log('🎯 Destination:', lockEvent.destinationAddress);
            console.log('💰 Amount:', lockEvent.amount, 'lamports');

            // Convert lamports to EVM amount (1:1 ratio for demo)
            const evmAmount = this.convertLamportsToEvmAmount(lockEvent.amount);
            const txHashBytes = ethers.keccak256(ethers.toUtf8Bytes(txSignature));

            // Call release function on EVM contract
            const evmTx = await this.evmContract.release(
                lockEvent.destinationAddress,
                evmAmount,
                txHashBytes
            );

            console.log('📤 EVM transaction sent:', evmTx.hash);

            const receipt = await evmTx.wait();
            console.log('✅ EVM transaction confirmed:', receipt.transactionHash);
            console.log('⛽ Gas used:', receipt.gasUsed.toString());

            console.log('🎉 Bridge completed successfully!');
            console.log('🔗 Solana TX:', txSignature);
            console.log('🔗 EVM TX:', receipt.transactionHash);

        } catch (error) {
            console.error('❌ Failed to process bridge request:', error);
        }
    }

    convertLamportsToEvmAmount(lamports) {
        // Convert lamports to wei (1:1 ratio)
        // 1 SOL = 1e9 lamports -> 1 ETH equivalent = 1e18 wei
        return BigInt(lamports) * BigInt(1e9);
    }
}

// Environment validation
function validateEnvironment() {
    const required = ['ADMIN_PRIVATE_KEY', 'EVM_CONTRACT_ADDRESS'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing);
        console.log('💡 Create a .env file with:');
        console.log('ADMIN_PRIVATE_KEY=your_sepolia_private_key');
        console.log('EVM_CONTRACT_ADDRESS=your_deployed_contract_address');
        console.log('SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
        process.exit(1);
    }
}

// Start the indexer
if (require.main === module) {
    validateEnvironment();

    const indexer = new BridgeIndexer();
    indexer.start().catch(console.error);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down indexer...');
        process.exit(0);
    });
}

module.exports = BridgeIndexer;