const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Bridge EVM contract to Sepolia...");

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
        ethers.parseEther("1000000") // 1M tokens initial supply
    );
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log("✅ Mock Bridge Token deployed to:", mockTokenAddress);

    // Deploy the Bridge EVM contract
    console.log("\n🌉 Deploying Bridge EVM...");
    const BridgeEVM = await ethers.getContractFactory("BridgeEVM");
    const bridgeEVM = await BridgeEVM.deploy(
        mockTokenAddress, // Bridge token address
        deployer.address  // Initial owner
    );

    await bridgeEVM.waitForDeployment();
    const bridgeAddress = await bridgeEVM.getAddress();
    console.log("✅ Bridge EVM deployed to:", bridgeAddress);

    // Transfer some tokens to the bridge contract for testing
    console.log("\n💸 Funding bridge contract with initial tokens...");
    const fundAmount = ethers.parseEther("10000"); // 10K tokens
    await mockToken.transfer(bridgeAddress, fundAmount);
    console.log("✅ Transferred", ethers.formatEther(fundAmount), "BTK to bridge");

    // Verify deployment
    const contractBalance = await mockToken.balanceOf(bridgeAddress);
    console.log("🏦 Bridge contract token balance:", ethers.formatEther(contractBalance), "BTK");

    console.log("\n📋 Deployment Summary:");
    console.log("├── Mock Bridge Token:", mockTokenAddress);
    console.log("├── Bridge EVM Contract:", bridgeAddress);
    console.log("├── Owner:", deployer.address);
    console.log("└── Initial Bridge Balance:", ethers.formatEther(contractBalance), "BTK");

    console.log("\n🔧 Environment Variables for Indexer:");
    console.log(`EVM_CONTRACT_ADDRESS=${bridgeAddress}`);
    console.log(`BRIDGE_TOKEN_ADDRESS=${mockTokenAddress}`);

    console.log("\n⚡ Next Steps:");
    console.log("1. Update your indexer's .env file with the contract addresses above");
    console.log("2. Verify contracts on Etherscan (optional)");
    console.log("3. Start the indexer to begin monitoring bridge events");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });