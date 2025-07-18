const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Bridge Token Balances");
    console.log("================================\n");

    // Contract addresses from deployment
    const BRIDGE_CONTRACT = "0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE";
    const TOKEN_CONTRACT = "0xBF882e30001d6FE0537eEA26691a13d00b74353C";
    const USER_ADDRESS = "0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE";

    // Get provider and contracts
    const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/5kgI7ge-qk3WuMji0QvObz3tnSENzDo7");

    const tokenABI = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function totalSupply() view returns (uint256)"
    ];

    const token = new ethers.Contract(TOKEN_CONTRACT, tokenABI, provider);

    try {
        // Get token info
        const name = await token.name();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const totalSupply = await token.totalSupply();

        console.log("📋 Token Information:");
        console.log(`├── Name: ${name}`);
        console.log(`├── Symbol: ${symbol}`);
        console.log(`├── Decimals: ${decimals}`);
        console.log(`└── Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}\n`);

        // Check balances
        const bridgeBalance = await token.balanceOf(BRIDGE_CONTRACT);
        const userBalance = await token.balanceOf(USER_ADDRESS);

        console.log("💰 Current Balances:");
        console.log(`├── Bridge Contract: ${ethers.formatEther(bridgeBalance)} ${symbol}`);
        console.log(`└── Your Address: ${ethers.formatEther(userBalance)} ${symbol}\n`);

        // Check ETH balance too
        const ethBalance = await provider.getBalance(USER_ADDRESS);
        console.log(`💎 Your ETH Balance: ${ethers.formatEther(ethBalance)} ETH\n`);

        console.log("🎯 Results:");
        if (userBalance > 0) {
            console.log(`✅ SUCCESS! You have ${ethers.formatEther(userBalance)} ${symbol} tokens!`);
        } else {
            console.log("❌ You don't have any BTK tokens yet.");
            console.log("   This could mean:");
            console.log("   - The bridge transactions failed");
            console.log("   - The tokens haven't been released yet");
            console.log("   - There's an issue with the indexer");
        }

        console.log("\n📱 How to Add BTK Token to MetaMask:");
        console.log("==================================");
        console.log("1. Open MetaMask and switch to Sepolia network");
        console.log("2. Go to 'Import tokens' or 'Add token'");
        console.log("3. Select 'Custom token'");
        console.log("4. Enter these details:");
        console.log(`   Token Contract Address: ${TOKEN_CONTRACT}`);
        console.log(`   Token Symbol: ${symbol}`);
        console.log(`   Token Decimals: ${decimals}`);
        console.log("5. Click 'Add Custom Token' and then 'Import Tokens'");

        console.log("\n🔗 Useful Links:");
        console.log(`├── Token Contract: https://sepolia.etherscan.io/token/${TOKEN_CONTRACT}`);
        console.log(`├── Bridge Contract: https://sepolia.etherscan.io/address/${BRIDGE_CONTRACT}`);
        console.log(`└── Your Address: https://sepolia.etherscan.io/address/${USER_ADDRESS}`);

    } catch (error) {
        console.error("❌ Error checking balances:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }); 