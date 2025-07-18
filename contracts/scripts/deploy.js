const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Bidirectional Bridge EVM contract to Sepolia...");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);

    // Check deployer balance
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("0.01")) {
        console.warn("⚠️  Low balance! Make sure you have enough ETH for deployment");
    }

    // Deploy a mock ERC20 token first (for testing purposes)
    console.log("\n📋 Deploying Mock Bridge Token...");
    const MockToken = await ethers.getContractFactory("MockBridgeToken");
    const mockToken = await MockToken.deploy(
        "Bridge Token",
        "BTK",
        ethers.parseEther("1000000"), // 1M tokens initial supply
        deployer.address // Owner address
    );
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log("✅ Mock Bridge Token deployed to:", mockTokenAddress);

    // Deploy the Bridge EVM contract
    console.log("\n🌉 Deploying Bidirectional Bridge EVM...");
    const BridgeEVM = await ethers.getContractFactory("BridgeEVM");
    const bridgeEVM = await BridgeEVM.deploy(
        mockTokenAddress, // Bridge token address
        deployer.address  // Initial owner
    );

    await bridgeEVM.waitForDeployment();
    const bridgeAddress = await bridgeEVM.getAddress();
    console.log("✅ Bidirectional Bridge EVM deployed to:", bridgeAddress);

    // Transfer some tokens to the bridge contract for Solana→Sepolia bridging
    console.log("\n💸 Funding bridge contract with initial tokens...");
    const fundAmount = ethers.parseEther("100000"); // 100K tokens for Solana→Sepolia
    await mockToken.transfer(bridgeAddress, fundAmount);
    console.log("✅ Transferred", ethers.formatEther(fundAmount), "BTK to bridge for Solana→Sepolia");

    // Keep some tokens for deployer to test Sepolia→Solana bridging
    const deployerBalance = await mockToken.balanceOf(deployer.address);
    console.log("💰 Deployer BTK balance:", ethers.formatEther(deployerBalance), "BTK (for testing reverse bridge)");

    // Verify deployment
    const contractBalance = await mockToken.balanceOf(bridgeAddress);
    console.log("🏦 Bridge contract token balance:", ethers.formatEther(contractBalance), "BTK");

    console.log("\n📋 Deployment Summary:");
    console.log("├── Mock Bridge Token:", mockTokenAddress);
    console.log("├── Bidirectional Bridge Contract:", bridgeAddress);
    console.log("├── Owner:", deployer.address);
    console.log("├── Bridge Balance:", ethers.formatEther(contractBalance), "BTK");
    console.log("└── Deployer Balance:", ethers.formatEther(deployerBalance), "BTK");

    console.log("\n🔧 Environment Variables for Indexer:");
    console.log(`EVM_CONTRACT_ADDRESS=${bridgeAddress}`);
    console.log(`BRIDGE_TOKEN_ADDRESS=${mockTokenAddress}`);
    console.log(`SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`);
    console.log(`ADMIN_PRIVATE_KEY=${deployer.address === '0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE' ? 'your_private_key_here' : 'update_with_your_key'}`);

    console.log("\n⚡ Next Steps:");
    console.log("1. Update your indexer's .env file with the contract addresses above");
    console.log("2. Build and deploy the Solana program: anchor build && anchor deploy");
    console.log("3. Start the bidirectional indexer: cd ../indexer && npm start");
    console.log("4. Test Solana→Sepolia: node scripts/test-bridge.js lock 0.1 " + deployer.address);
    console.log("5. Test Sepolia→Solana: node scripts/test-reverse-bridge.js lock 0.1 YOUR_SOLANA_ADDRESS");
    console.log("6. Verify contracts on Etherscan (optional)");

    console.log("\n🌉 Bidirectional Bridge Features:");
    console.log("├── Solana → Sepolia: Lock SOL, receive BTK");
    console.log("├── Sepolia → Solana: Lock BTK, receive SOL");
    console.log("├── 1:1 conversion ratio");
    console.log("├── Double-spend protection");
    console.log("└── Event-driven architecture");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });