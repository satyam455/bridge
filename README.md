# 🌉 Cross-Chain Bridge: Solana ↔ Sepolia

A secure and efficient cross-chain bridge that enables seamless asset transfers between Solana and Ethereum (Sepolia testnet). Users can lock SOL on Solana and receive equivalent ERC20 tokens on Sepolia through an automated indexer system.

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Solana    │    │   Indexer    │    │   Sepolia   │
│   Program   │───▶│  (Node.js)   │───▶│   Contract  │
│             │    │              │    │             │
│ lock() SOL  │    │ Monitor &    │    │ release()   │
│ emit events │    │ Process      │    │ ERC20 tokens│
└─────────────┘    └──────────────┘    └─────────────┘
```

### Components

1. **Solana Program** (Rust/Anchor): Handles SOL locking and event emission
2. **JavaScript Indexer**: Monitors Solana events and triggers EVM releases
3. **EVM Contract** (Solidity): Manages token releases on Sepolia with owner controls

## ✨ Features

- 🔒 **Secure Locking**: SOL transfers with admin validation
- 📡 **Event Monitoring**: Real-time Solana transaction tracking
- 🔐 **Owner Controls**: EVM contract with `onlyOwner` modifier
- 🚫 **Double-Spend Protection**: Transaction hash tracking
- ⚡ **Automated Processing**: Seamless cross-chain execution
- 🧪 **Comprehensive Testing**: Full test coverage for all components

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
EVM_CONTRACT_ADDRESS=0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE
BRIDGE_TOKEN_ADDRESS=0xBF882e30001d6FE0537eEA26691a13d00b74353C
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

## 📋 Deployed Contracts

### Solana (Devnet)
- **Program ID**: `6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5`
- **Bridge State PDA**: `6kdLNtKYgdn9JJhCGBiyHFBmth6gPsnqX2cL5YYH7beW`
- **Network**: Devnet
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/address/6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5?cluster=devnet)

### Sepolia (Ethereum Testnet)
- **Bridge Contract**: [`0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE`](https://sepolia.etherscan.io/address/0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE)
- **Bridge Token (BTK)**: [`0xBF882e30001d6FE0537eEA26691a13d00b74353C`](https://sepolia.etherscan.io/token/0xBF882e30001d6FE0537eEA26691a13d00b74353C)
- **Admin Address**: `0xB4d1cC3386a83c70972E9f9095dDB9D494BF7EAE`

## 🎮 Usage

### 1. Initialize Bridge (One-time)

```bash
cd bridge
node scripts/test-bridge.js init
```

### 2. Lock SOL on Solana

```bash
# Lock 0.1 SOL for destination address
node scripts/test-bridge.js lock 0.1 0xYourSepoliaAddress
```

### 3. Start Indexer

```bash
cd indexer
npm start
```

### 4. Add BTK Token to MetaMask

1. Switch to Sepolia network
2. Import custom token:
   - **Address**: `0xBF882e30001d6FE0537eEA26691a13d00b74353C`
   - **Symbol**: `BTK`
   - **Decimals**: `18`

### 5. Check Balances

```bash
cd contracts
node scripts/check-balances.js
```

## 🔄 Bridge Process

1. **User calls `lock()`** on Solana with SOL amount and destination address
2. **SOL transferred** to admin address
3. **Event emitted** with lock details
4. **Indexer detects** event and processes transaction
5. **EVM contract releases** equivalent BTK tokens to user
6. **User receives tokens** in their Sepolia wallet

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
# Test full bridge flow
node scripts/test-bridge.js lock 0.01 0xYourAddress
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
├── indexer/              # Event monitoring service
│   ├── indexer.js        # Main indexer logic
│   └── package.json      # Dependencies
└── scripts/              # Testing utilities
    └── test-bridge.js    # Bridge interaction script
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

- **Amount Validation**: Maximum 1 SOL per transaction
- **Address Validation**: Ethereum address format verification
- **Owner Controls**: Only admin can release tokens
- **Reentrancy Protection**: OpenZeppelin ReentrancyGuard
- **Double-Spend Prevention**: Transaction hash tracking
- **Event Emission**: Full transaction transparency

## 📊 Transaction Limits

- **Minimum Lock**: 0.001 SOL (1,000,000 lamports)
- **Maximum Lock**: 1 SOL (1,000,000,000 lamports)
- **Conversion Rate**: 1 SOL = 1 BTK (1:1 ratio)

## 🔗 Useful Links

- [Solana Program Explorer](https://explorer.solana.com/address/6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5?cluster=devnet)
- [Sepolia Bridge Contract](https://sepolia.etherscan.io/address/0x9899B1DBB12769a52d3B56955F0B5a2c7d46FbdE)
- [BTK Token Contract](https://sepolia.etherscan.io/token/0xBF882e30001d6FE0537eEA26691a13d00b74353C)

## 🚨 Important Notes

1. **Testnet Only**: This bridge operates on Devnet (Solana) and Sepolia (Ethereum)
2. **BTK Tokens**: You receive ERC20 tokens (BTK), not ETH directly
3. **Add Token**: Remember to add BTK token to MetaMask to see your balance
4. **Admin Key**: Keep your admin private key secure and never share it
5. **Gas Fees**: Ensure sufficient Sepolia ETH for transaction fees

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
