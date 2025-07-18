# 🌉 Cross-Chain Bridge: Solana ↔ Sepolia

A secure and efficient **bidirectional** cross-chain bridge that enables seamless asset transfers between Solana and Ethereum (Sepolia testnet). Users can:
- Lock SOL on Solana and receive BTK tokens on Sepolia
- Lock BTK tokens on Sepolia and receive SOL on Solana

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Solana    │◄──►│   Indexer    │◄──►│   Sepolia   │
│   Program   │    │  (Node.js)   │    │   Contract  │
│             │    │              │    │             │
│ lock() SOL  │───▶│ Bidirectional│───▶│ release()   │
│ release()   │◄───│ Monitoring & │◄───│ lock() BTK  │
│ emit events │    │ Processing   │    │ emit events │
└─────────────┘    └──────────────┘    └─────────────┘
```

### Components

1. **Solana Program** (Rust/Anchor): Handles SOL locking/releasing and event emission
2. **Bidirectional Indexer**: Monitors events from both chains and triggers cross-chain actions
3. **EVM Contract** (Solidity): Manages BTK token locking/releasing with owner controls

## ✨ Features

- 🔄 **Bidirectional Bridge**: Both Solana→Sepolia and Sepolia→Solana
- 🔒 **Secure Locking**: SOL and BTK transfers with admin validation
- 📡 **Event Monitoring**: Real-time monitoring of both blockchain events
- 🔐 **Owner Controls**: EVM contract with `onlyOwner` modifier
- 🚫 **Double-Spend Protection**: Transaction hash tracking on both chains
- ⚡ **Automated Processing**: Seamless cross-chain execution
- 🧪 **Comprehensive Testing**: Full test coverage for all components
- 🎯 **1:1 Conversion**: 1 SOL = 1 BTK ratio

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust & Anchor CLI
- Solana CLI
- Hardhat
- MetaMask with Sepolia testnet

### Installation

```bash
git clone https://github.com/satyam455/bridge.git
cd bridge

# Install dependencies
cd bridge && yarn install
cd contracts && npm install
cd ../indexer && npm install
cd ../scripts && npm install
```

### Environment Setup

Create `.env` files:

**indexer/.env:**
```env
ADMIN_PRIVATE_KEY=your_sepolia_private_key
EVM_CONTRACT_ADDRESS=0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97
BRIDGE_TOKEN_ADDRESS=0x683dB3BD882864C9c12E93747050EC6d093B1A72
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

## 📋 Deployed Contracts

### Solana (Devnet)
- **Program ID**: `6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5`
- **Bridge State PDA**: `6kdLNtKYgdn9JJhCGBiyHFBmth6gPsnqX2cL5YYH7beW`
- **Network**: Devnet
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/address/6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5?cluster=devnet)

### Sepolia (Ethereum Testnet)
- **Bridge Contract**: [`0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97`](https://sepolia.etherscan.io/address/0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97)
- **Bridge Token (BTK)**: [`0x683dB3BD882864C9c12E93747050EC6d093B1A72`](https://sepolia.etherscan.io/token/0x683dB3BD882864C9c12E93747050EC6d093B1A72)
- **Admin Address**: `0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE`

## 🎮 Usage

### 1. Initialize Bridge (One-time)

```bash
cd bridge
node scripts/test-bridge.js init
```

### 2. Start Bidirectional Indexer

```bash
cd indexer
npm start
```

**Keep this running** - it monitors both chains and processes bridge requests.

## 🔄 Bridge Operations

### Solana → Sepolia (Lock SOL, Get BTK)

```bash
# Lock SOL on Solana to receive BTK on Sepolia
node scripts/test-bridge.js lock 0.1 0xYourSepoliaAddress
```

**Process:**
1. SOL locked on Solana
2. Event emitted and detected by indexer
3. BTK tokens released on Sepolia
4. Add BTK token to MetaMask to see balance

### Sepolia → Solana (Lock BTK, Get SOL)

```bash
# Lock BTK on Sepolia to receive SOL on Solana  
node scripts/test-reverse-bridge.js lock 0.1 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
```

**Process:**
1. BTK tokens locked on Sepolia
2. Event emitted and detected by indexer
3. SOL released on Solana
4. Check your Solana wallet balance

### 3. Add BTK Token to MetaMask

1. Switch to Sepolia network
2. Import custom token:
   - **Address**: `0x683dB3BD882864C9c12E93747050EC6d093B1A72`
   - **Symbol**: `BTK`
   - **Decimals**: `18`

### 4. Check Balances

```bash
# Check Sepolia balances
cd contracts
node scripts/check-balances.js

# Check bridge status
node scripts/test-bridge.js status
node scripts/test-reverse-bridge.js status
```

## 🔄 Complete Bridge Process Examples

### Example 1: Solana → Sepolia

```bash
# 1. Start indexer (keep running)
cd indexer && npm start

# 2. In another terminal, lock SOL
cd ../
node scripts/test-bridge.js lock 0.1 0xYourSepoliaAddress

# 3. Wait for indexer to process (watch logs)
# 4. Check your BTK balance on Sepolia
cd contracts && node scripts/check-balances.js
```

### Example 2: Sepolia → Solana

```bash
# 1. Make sure you have BTK tokens (bridge some SOL first)
# 2. Lock BTK tokens for Solana
node scripts/test-reverse-bridge.js lock 0.05 YourSolanaAddress

# 3. Wait for indexer to process
# 4. Check your SOL balance on Solana
solana balance YourSolanaAddress
```

## 🧪 Testing

### Solana Program Tests
```bash
cd bridge
anchor test
```

### EVM Contract Tests
```bash
cd contracts
npx hardhat test
```

### Integration Testing
```bash
# Test both directions
node scripts/test-bridge.js lock 0.01 0xYourAddress
node scripts/test-reverse-bridge.js lock 0.01 YourSolanaAddress
```

## 📁 Project Structure

```
bridge/
├── bridge/                 # Anchor workspace
│   ├── programs/bridge/    # Solana program (Rust)
│   ├── tests/             # Solana tests
│   └── target/            # Build artifacts
├── contracts/             # EVM contracts
│   ├── contracts/         # Solidity contracts
│   ├── scripts/          # Deployment scripts
│   └── test/             # EVM tests
├── indexer/              # Bidirectional event monitoring service
│   ├── indexer.js        # Main indexer logic
│   └── package.json      # Dependencies
└── scripts/              # Testing utilities
    ├── test-bridge.js        # Solana→Sepolia bridge testing
    └── test-reverse-bridge.js # Sepolia→Solana bridge testing
```

## 🔧 Development

### Building

```bash
# Build Solana program
cd bridge && anchor build

# Compile EVM contracts
cd contracts && npx hardhat compile
```

### Local Development

```bash
# Start local Solana validator
solana-test-validator

# Deploy to local (modify scripts for localhost)
anchor deploy
npx hardhat run scripts/deploy.js --network localhost
```

## 🛡️ Security Features

- **Amount Validation**: Maximum 1 SOL/BTK per transaction
- **Address Validation**: Ethereum and Solana address format verification
- **Owner Controls**: Only admin can release tokens/SOL
- **Reentrancy Protection**: OpenZeppelin ReentrancyGuard
- **Double-Spend Prevention**: Transaction hash tracking on both chains
- **Event Emission**: Full transaction transparency
- **Bidirectional Tracking**: Separate processing maps for each direction

## 📊 Transaction Limits

- **Minimum Lock**: 0.001 SOL/BTK
- **Maximum Lock**: 1 SOL/BTK per transaction
- **Conversion Rate**: 1 SOL = 1 BTK (1:1 ratio)
- **Supported Directions**: Both Solana↔Sepolia

## 🔗 Useful Links

- [Solana Program Explorer](https://explorer.solana.com/address/6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5?cluster=devnet)
- [Sepolia Bridge Contract](https://sepolia.etherscan.io/address/0xE40eaa9DdDA5126d3C7a3BDA27D216e69bd67d97)
- [BTK Token Contract](https://sepolia.etherscan.io/token/0x683dB3BD882864C9c12E93747050EC6d093B1A72)

## 🚨 Important Notes

1. **Testnet Only**: This bridge operates on Devnet (Solana) and Sepolia (Ethereum)
2. **Indexer Required**: The bidirectional indexer must be running for both directions
3. **BTK Tokens**: Add BTK token to MetaMask to see your balance
4. **Admin Key**: Keep your admin private key secure and never share it
5. **Gas Fees**: Ensure sufficient ETH for Sepolia transactions, SOL for Solana transactions
6. **Bidirectional**: Both directions are supported with the same conversion rate

## 🔄 Bridge Directions

| Direction | Lock | Receive | Command |
|-----------|------|---------|---------|
| Solana → Sepolia | SOL | BTK | `test-bridge.js lock` |
| Sepolia → Solana | BTK | SOL | `test-reverse-bridge.js lock` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

Built with ❤️ by [satyam455](https://github.com/satyam455)

---

**⚠️ Disclaimer**: This is a testnet implementation for educational purposes. Do not use with mainnet funds without proper security audits.
