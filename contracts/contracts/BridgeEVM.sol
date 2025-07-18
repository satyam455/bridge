// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BridgeEVM is Ownable, ReentrancyGuard {
    IERC20 public bridgeToken;
    
    // Track processed Solana transactions to prevent double spending
    mapping(bytes32 => bool) public processedTxs;
    
    // Events
    event Released(address indexed recipient, uint256 amount, bytes32 indexed solanaTxHash, uint256 timestamp);
    event TokenDeposited(address indexed from, uint256 amount, uint256 timestamp);
    event EmergencyWithdraw(address indexed to, uint256 amount, uint256 timestamp);
    
    // Errors
    error TransactionAlreadyProcessed();
    error InvalidAmount();
    error InvalidRecipient();
    error InsufficientBalance();
    error TransferFailed();
    
    constructor(address _bridgeToken, address _owner) Ownable(_owner) {
        require(_bridgeToken != address(0), "Invalid token address");
        bridgeToken = IERC20(_bridgeToken);
    }
    
    /**
     * @dev Release tokens to user after SOL is locked on Solana
     * @param to Recipient address on EVM chain
     * @param amount Amount to release (in token units)
     * @param solanaTxHash Transaction hash from Solana lock event
     */
    function release(
        address to,
        uint256 amount,
        bytes32 solanaTxHash
    ) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (processedTxs[solanaTxHash]) revert TransactionAlreadyProcessed();
        
        // Check bridge has sufficient balance
        uint256 balance = bridgeToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        // Mark transaction as processed
        processedTxs[solanaTxHash] = true;
        
        // Transfer tokens to recipient
        bool success = bridgeToken.transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit Released(to, amount, solanaTxHash, block.timestamp);
    }
    
    /**
     * @dev Deposit tokens to the bridge (for funding)
     * @param amount Amount to deposit
     */
    function depositTokens(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        
        bool success = bridgeToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        emit TokenDeposited(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Emergency withdraw function for owner
     * @param to Address to send tokens to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        
        uint256 balance = bridgeToken.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        bool success = bridgeToken.transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit EmergencyWithdraw(to, amount, block.timestamp);
    }
    
    /**
     * @dev Get bridge token balance
     */
    function getBridgeBalance() external view returns (uint256) {
        return bridgeToken.balanceOf(address(this));
    }
    
    /**
     * @dev Check if Solana transaction has been processed
     */
    function isTransactionProcessed(bytes32 solanaTxHash) external view returns (bool) {
        return processedTxs[solanaTxHash];
    }
}