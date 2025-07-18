const { ethers } = require('ethers');
require('dotenv').config({ path: '../indexer/.env' });

// Configuration
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/5kgI7ge-qk3WuMji0QvObz3tnSENzDo7';
const EVM_CONTRACT_ADDRESS = process.env.EVM_CONTRACT_ADDRESS || '0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97';
const BRIDGE_TOKEN_ADDRESS = process.env.BRIDGE_TOKEN_ADDRESS || '0x683dB3BD882864C9c12E93747050EC6d093B1A72';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Contract ABIs
const BRIDGE_ABI = [
    "function lock(uint256 amount, string calldata solanaAddress) external",
    "function getBridgeBalance() external view returns (uint256)",
    "function isSepoliaToSolanaTransactionProcessed(bytes32 sepoliaTxHash) external view returns (bool)",
    "event Locked(address indexed from, uint256 amount, string indexed solanaAddress, uint256 timestamp)"
];

const TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

async function main() {
    console.log('🌉 Reverse Bridge Testing Script (Sepolia → Solana)');
    console.log('=====================================================');

    if (!ADMIN_PRIVATE_KEY) {
        console.error('❌ ADMIN_PRIVATE_KEY not found in environment');
        console.log('💡 Create indexer/.env file with your private key');
        return;
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log('✅ Connected to Sepolia testnet');
    console.log('📝 Wallet address:', wallet.address);

    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('💰 ETH Balance:', ethers.formatEther(ethBalance), 'ETH');

    if (ethBalance < ethers.parseEther("0.001")) {
        console.warn('⚠️  Low ETH balance! You need ETH for gas fees');
        console.log('🪂 Get Sepolia ETH from: https://sepoliafaucet.com/');
    }

    // Setup contracts
    const bridgeContract = new ethers.Contract(EVM_CONTRACT_ADDRESS, BRIDGE_ABI, wallet);
    const tokenContract = new ethers.Contract(BRIDGE_TOKEN_ADDRESS, TOKEN_ABI, wallet);

    // Get token info
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const tokenDecimals = await tokenContract.decimals();

    console.log('\n📋 Token Information:');
    console.log('├── Name:', tokenName);
    console.log('├── Symbol:', tokenSymbol);
    console.log('└── Decimals:', tokenDecimals);

    // Check user's BTK balance
    const userBalance = await tokenContract.balanceOf(wallet.address);
    console.log('\n💰 Your BTK Balance:', ethers.formatEther(userBalance), tokenSymbol);

    if (userBalance === 0n) {
        console.log('\n❌ You need BTK tokens to test reverse bridging!');
        console.log('💡 First bridge some SOL to Sepolia to get BTK tokens:');
        console.log('   cd ../');
        console.log('   node scripts/test-bridge.js lock 0.1 ' + wallet.address);
        console.log('   Wait for indexer to process, then come back here');
        return;
    }

    const command = process.argv[2];

    if (command === 'lock') {
        const amountStr = process.argv[3];
        const solanaAddress = process.argv[4];

        if (!amountStr || !solanaAddress) {
            console.log('\n📋 Usage: node test-reverse-bridge.js lock <amount_in_btk> <solana_address>');
            console.log('Example: node test-reverse-bridge.js lock 0.1 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
            console.log('\n💡 Tips:');
            console.log('- Amount should be in BTK tokens (e.g., 0.1 for 0.1 BTK)');
            console.log('- Solana address should be a valid base58 address');
            console.log('- You will receive the same amount in SOL on Solana');
            return;
        }

        const amount = ethers.parseEther(amountStr);

        // Validate Solana address (basic check)
        if (solanaAddress.length < 32 || solanaAddress.length > 44) {
            console.error('❌ Invalid Solana address format');
            console.log('💡 Example valid address: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
            return;
        }

        console.log('\n🔒 Locking BTK tokens for bridge to Solana...');
        console.log('├── Amount:', amountStr, tokenSymbol);
        console.log('├── Destination:', solanaAddress);
        console.log('└── Expected SOL:', amountStr, 'SOL');

        if (amount > userBalance) {
            console.error('❌ Insufficient BTK balance');
            console.log('Available:', ethers.formatEther(userBalance), tokenSymbol);
            return;
        }

        try {
            // Check allowance
            const allowance = await tokenContract.allowance(wallet.address, EVM_CONTRACT_ADDRESS);

            if (allowance < amount) {
                console.log('📝 Approving BTK tokens...');
                const approveTx = await tokenContract.approve(EVM_CONTRACT_ADDRESS, amount);
                console.log('⏳ Approval transaction sent:', approveTx.hash);
                await approveTx.wait();
                console.log('✅ BTK tokens approved');
            }

            // Lock tokens
            console.log('🔒 Locking BTK tokens...');
            const lockTx = await bridgeContract.lock(amount, solanaAddress);
            console.log('📝 Lock transaction sent:', lockTx.hash);

            const receipt = await lockTx.wait();
            console.log('✅ BTK tokens locked successfully!');
            console.log('🔗 View on Etherscan: https://sepolia.etherscan.io/tx/' + lockTx.hash);
            console.log('⛽ Gas used:', receipt.gasUsed.toString());

            // Parse the Locked event
            const lockEvent = receipt.logs.find(log => {
                try {
                    const parsed = bridgeContract.interface.parseLog(log);
                    return parsed.name === 'Locked';
                } catch {
                    return false;
                }
            });

            if (lockEvent) {
                const parsed = bridgeContract.interface.parseLog(lockEvent);
                console.log('\n📡 Event Emitted:');
                console.log('├── From:', parsed.args.from);
                console.log('├── Amount:', ethers.formatEther(parsed.args.amount), tokenSymbol);
                console.log('├── Solana Address:', parsed.args.solanaAddress);
                console.log('└── Timestamp:', new Date(Number(parsed.args.timestamp) * 1000).toISOString());
            }

            console.log('\n🎯 Next Steps:');
            console.log('1. Make sure the bidirectional indexer is running');
            console.log('2. The indexer will detect this lock event');
            console.log('3. SOL will be released to your Solana address');
            console.log('4. Check your Solana wallet balance after a few minutes');

        } catch (error) {
            console.error('❌ Lock failed:', error.message);

            if (error.message.includes('insufficient funds')) {
                console.log('💡 Make sure you have enough ETH for gas fees');
            } else if (error.message.includes('ERC20: transfer amount exceeds allowance')) {
                console.log('💡 Try approving a larger amount or check token balance');
            }
        }

    } else if (command === 'status') {
        console.log('\n📊 Reverse Bridge Status...');

        try {
            const bridgeBalance = await bridgeContract.getBridgeBalance();
            console.log('├── Bridge BTK Balance:', ethers.formatEther(bridgeBalance), tokenSymbol);
            console.log('├── Your BTK Balance:', ethers.formatEther(userBalance), tokenSymbol);

            const allowance = await tokenContract.allowance(wallet.address, EVM_CONTRACT_ADDRESS);
            console.log('└── Your Allowance:', ethers.formatEther(allowance), tokenSymbol);

        } catch (error) {
            console.error('❌ Failed to get status:', error.message);
        }

    } else if (command === 'check') {
        const txHash = process.argv[3];

        if (!txHash) {
            console.log('\nUsage: node test-reverse-bridge.js check <transaction_hash>');
            return;
        }

        console.log('\n🔍 Checking transaction status...');

        try {
            const txHashBytes = ethers.id(txHash);
            const isProcessed = await bridgeContract.isSepoliaToSolanaTransactionProcessed(txHashBytes);

            console.log('├── Transaction Hash:', txHash);
            console.log('└── Processed Status:', isProcessed ? '✅ Processed' : '⏳ Pending');

            if (!isProcessed) {
                console.log('\n💡 If this transaction has been pending for a while:');
                console.log('1. Check if the indexer is running');
                console.log('2. Verify the Solana address is valid');
                console.log('3. Check indexer logs for errors');
            }

        } catch (error) {
            console.error('❌ Failed to check status:', error.message);
        }

    } else {
        console.log('\n📋 Available Commands:');
        console.log('├── lock <amount> <solana_address> - Lock BTK tokens for bridge to Solana');
        console.log('├── status                          - Check bridge and balance status');
        console.log('└── check <tx_hash>                 - Check if transaction was processed');

        console.log('\nExamples:');
        console.log('node test-reverse-bridge.js lock 0.1 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
        console.log('node test-reverse-bridge.js status');
        console.log('node test-reverse-bridge.js check 0x1234567890abcdef...');

        console.log('\n🔗 Useful Links:');
        console.log('├── BTK Token: https://sepolia.etherscan.io/token/' + BRIDGE_TOKEN_ADDRESS);
        console.log('├── Bridge Contract: https://sepolia.etherscan.io/address/' + EVM_CONTRACT_ADDRESS);
        console.log('└── Your Address: https://sepolia.etherscan.io/address/' + wallet.address);
    }
}

main().catch(console.error); 