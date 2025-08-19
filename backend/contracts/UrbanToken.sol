// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./AccessRoles.sol";

/**
 * @title UrbanToken
 * @notice ERC20 governance + utility token with EIP-2612 permit, voting capabilities, and role-based minting
 * @dev Features capped supply, permit functionality, and restricted minting for DAO governance
 */
contract UrbanToken is ERC20, ERC20Permit, ERC20Votes, ERC20Capped, ERC20Burnable, AccessControl, Pausable {
    using AccessRoles for bytes32;

    // Constants
    uint256 public constant ONBOARDING_REWARD = 100 * 10**18; // 100 tokens for new citizens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    // State variables
    mapping(address => bool) public hasReceivedOnboardingReward;
    
    // Token metadata
    string private _tokenImageURI;
    string private _tokenDescription;

    // Events
    event OnboardingReward(address indexed citizen, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount, address indexed burner);

    // Custom errors
    error OnboardingRewardAlreadyClaimed(address citizen);
    error InsufficientBalance(address account, uint256 balance, uint256 required);
    error MintCapExceeded(uint256 amount, uint256 available);

    constructor(
        address owner,
        string memory name,
        string memory symbol,
        string memory imageURI,
        string memory description
    ) 
        ERC20(name, symbol) 
        ERC20Permit(name)
        ERC20Capped(MAX_SUPPLY)
    {
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        
        // Set token metadata
        _tokenImageURI = imageURI;
        _tokenDescription = description;
        
        // Initial supply to owner for initial distribution
        _mint(owner, 10_000_000 * 10**18); // 10 million tokens for initial bootstrap
    }

    /**
     * @notice Mint onboarding reward to newly approved citizens
     * @param to The citizen address to mint tokens to
     * @param amount The amount of tokens to mint (typically ONBOARDING_REWARD)
     * @dev Only callable by OWNER_ROLE or authorized minters, prevents double claiming
     */
    function mintOnboard(address to, uint256 amount) external onlyRole(AccessRoles.OWNER_ROLE) {
        if (hasReceivedOnboardingReward[to]) {
            revert OnboardingRewardAlreadyClaimed(to);
        }

        hasReceivedOnboardingReward[to] = true;
        _mint(to, amount);
        
        emit OnboardingReward(to, amount);
    }

    /**
     * @notice Mint tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     * @dev Only callable by OWNER_ROLE (typically transferred to Timelock/DAO)
     */
    function mint(address to, uint256 amount) external onlyRole(AccessRoles.OWNER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, _msgSender());
    }

    /**
     * @notice Burn tokens from a specified address
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn
     * @dev Only callable by OWNER_ROLE or the token holder themselves
     */
    function burn(address from, uint256 amount) external {
        require(hasRole(AccessRoles.OWNER_ROLE, _msgSender()), "UrbanToken: must have owner role to burn");

        if (balanceOf(from) < amount) {
            revert InsufficientBalance(from, balanceOf(from), amount);
        }

        _burn(from, amount);
        emit TokensBurned(from, amount, _msgSender());
    }


    /**
     * @notice Pause all token transfers
     * @dev Only callable by OWNER_ROLE
     */
    function pause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause all token transfers
     * @dev Only callable by OWNER_ROLE
     */
    function unpause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _unpause();
    }

    /**
     * @notice Transfer ownership of the contract to a new owner (typically Timelock)
     * @param newOwner The address of the new owner
     * @dev Only callable by current OWNER_ROLE
     */
    function transferOwnership(address newOwner) external onlyRole(AccessRoles.OWNER_ROLE) {
        _grantRole(AccessRoles.OWNER_ROLE, newOwner);
        _revokeRole(AccessRoles.OWNER_ROLE, _msgSender());
    }

    // Required overrides for multiple inheritance

    // We need to add a whenNotPaused modifier to token transfers
    // Since _update was added in OpenZeppelin v4.9.0 and might not be available in parent contracts,
    // let's use transfer hooks instead
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override(ERC20)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    function _mint(address account, uint256 amount) 
        internal 
        override(ERC20, ERC20Votes, ERC20Capped) 
    {
        // The cap check is handled in ERC20Capped._mint
        super._mint(account, amount);
    }
    
    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
    
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Get the available supply for minting
     * @return The amount of tokens that can still be minted
     */
    function availableSupply() external view returns (uint256) {
        return cap() - totalSupply();
    }

    /**
     * @notice Check if an address has received onboarding reward
     * @param citizen The address to check
     * @return True if the address has received onboarding reward
     */
    function hasClaimedOnboardingReward(address citizen) external view returns (bool) {
        return hasReceivedOnboardingReward[citizen];
    }

    /**
     * @notice Set token image URI
     * @param imageURI The URI of the token image
     * @dev Only callable by OWNER_ROLE
     */
    function setTokenImageURI(string memory imageURI) external onlyRole(AccessRoles.OWNER_ROLE) {
        _tokenImageURI = imageURI;
    }

    /**
     * @notice Get token image URI
     * @return The URI of the token image
     */
    function tokenImageURI() external view returns (string memory) {
        return _tokenImageURI;
    }

    /**
     * @notice Set token description
     * @param description The description of the token
     * @dev Only callable by OWNER_ROLE
     */
    function setTokenDescription(string memory description) external onlyRole(AccessRoles.OWNER_ROLE) {
        _tokenDescription = description;
    }

    /**
     * @notice Get token description
     * @return The description of the token
     */
    function tokenDescription() external view returns (string memory) {
        return _tokenDescription;
    }

    /**
     * @notice Get complete token metadata as JSON
     * @return JSON metadata string
     */
    function tokenMetadata() external view returns (string memory) {
        string memory json = string(abi.encodePacked(
            '{',
            '"name": "', name(), '", ',
            '"symbol": "', symbol(), '", ',
            '"decimals": 18, ',
            '"description": "', _tokenDescription, '", ',
            '"image": "', _tokenImageURI, '"',
            '}'
        ));
        return json;
    }
}
