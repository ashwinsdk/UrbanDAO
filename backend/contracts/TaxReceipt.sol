// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./AccessRoles.sol";

/**
 * @title TaxReceipt
 * @notice Soul-bound ERC721 NFT representing tax payment receipts
 * @dev Non-transferable NFTs that prove tax compliance for citizens
 */
contract TaxReceipt is ERC721, ERC721Enumerable, AccessControl, Pausable {
    
    // Override required for ERC721Enumerable
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    using AccessRoles for bytes32;

    // Receipt data structure
    struct Receipt {
        address citizen;
        uint256 year;
        uint256 amount;
        bytes32 docsHash;
        uint256 timestamp;
        address issuedBy;
    }

    // State variables
    uint256 private _nextTokenId;
    mapping(uint256 => Receipt) public receipts;
    mapping(address => mapping(uint256 => uint256)) public citizenYearToTokenId;
    mapping(address => uint256[]) public citizenReceipts;

    // Events
    event TaxReceiptMinted(
        uint256 indexed tokenId,
        address indexed citizen,
        uint256 indexed year,
        uint256 amount,
        bytes32 docsHash
    );

    // Custom errors
    error SoulBoundToken();
    error OnlyTaxModule();
    error ReceiptAlreadyExists(address citizen, uint256 year);
    error InvalidYear(uint256 year);
    error InvalidAmount(uint256 amount);

    constructor(address owner) ERC721("UrbanDAO Tax Receipt", "UDTR") {
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a tax receipt NFT for a citizen
     * @param citizen The citizen who paid the tax
     * @param year The tax year
     * @param amount The tax amount paid
     * @param docsHash IPFS hash of supporting documents
     * @dev Only callable by TaxModule (with OWNER_ROLE or designated minter role)
     */
    function safeMintReceipt(
        address citizen,
        uint256 year,
        uint256 amount,
        bytes32 docsHash
    ) external onlyRole(AccessRoles.OWNER_ROLE) whenNotPaused {
        if (year < 2020 || year > 2100) {
            revert InvalidYear(year);
        }
        if (amount == 0) {
            revert InvalidAmount(amount);
        }
        if (citizenYearToTokenId[citizen][year] != 0) {
            revert ReceiptAlreadyExists(citizen, year);
        }

        uint256 tokenId = _nextTokenId++;
        
        // Store receipt data
        receipts[tokenId] = Receipt({
            citizen: citizen,
            year: year,
            amount: amount,
            docsHash: docsHash,
            timestamp: block.timestamp,
            issuedBy: _msgSender()
        });

        // Update mappings
        citizenYearToTokenId[citizen][year] = tokenId;
        citizenReceipts[citizen].push(tokenId);

        // Mint the NFT
        _safeMint(citizen, tokenId);

        emit TaxReceiptMinted(tokenId, citizen, year, amount, docsHash);
    }

    /**
     * @notice Get receipt data for a token ID
     * @param tokenId The token ID to query
     * @return Receipt data structure
     */
    function getReceipt(uint256 tokenId) external view returns (Receipt memory) {
        require(_ownerOf(tokenId) != address(0), "TaxReceipt: token does not exist");
        return receipts[tokenId];
    }

    /**
     * @notice Get token ID for a citizen's tax receipt for a specific year
     * @param citizen The citizen address
     * @param year The tax year
     * @return Token ID (0 if no receipt exists)
     */
    function getReceiptTokenId(address citizen, uint256 year) external view returns (uint256) {
        return citizenYearToTokenId[citizen][year];
    }

    /**
     * @notice Get all receipt token IDs for a citizen
     * @param citizen The citizen address
     * @return Array of token IDs
     */
    function getCitizenReceipts(address citizen) external view returns (uint256[] memory) {
        return citizenReceipts[citizen];
    }

    /**
     * @notice Check if a citizen has paid tax for a specific year
     * @param citizen The citizen address
     * @param year The tax year
     * @return True if citizen has a receipt for the year
     */
    function hasPaidTax(address citizen, uint256 year) external view returns (bool) {
        return citizenYearToTokenId[citizen][year] != 0;
    }

    /**
     * @notice Get tax compliance years for a citizen
     * @param citizen The citizen address
     * @return Array of years the citizen has paid taxes
     */
    function getTaxComplianceYears(address citizen) external view returns (uint256[] memory) {
        uint256[] memory tokenIds = citizenReceipts[citizen];
        uint256[] memory taxYears = new uint256[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            taxYears[i] = receipts[tokenIds[i]].year;
        }
        
        return taxYears;
    }

    /**
     * @notice Pause contract functionality
     * @dev Only callable by OWNER_ROLE
     */
    function pause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract functionality
     * @dev Only callable by OWNER_ROLE
     */
    function unpause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _unpause();
    }

    // Soul-bound functionality: Override transfer functions to prevent transfers

    /**
     * @notice Override _update to prevent transfers (soul-bound)
     * @dev Reverts on any transfer attempt except minting
     */
    // Override transferFrom to prevent transfers (soul-bound)
    function transferFrom(address, address, uint256) public pure override(IERC721, ERC721) {
        revert SoulBoundToken();
    }
    
    // Override safeTransferFrom to prevent transfers (soul-bound)
    function safeTransferFrom(address, address, uint256) public pure override(IERC721, ERC721) {
        revert SoulBoundToken();
    }
    
    // Override safeTransferFrom with data to prevent transfers (soul-bound)
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override(IERC721, ERC721) {
        revert SoulBoundToken();
    }

    /**
     * @notice Override approve to prevent approvals (soul-bound)
     */
    function approve(address, uint256) public pure override(IERC721, ERC721) {
        revert SoulBoundToken();
    }

    // Override setApprovalForAll to prevent approval
    function setApprovalForAll(address, bool) public pure override(IERC721, ERC721) {
        revert SoulBoundToken();
    }

    // Override getApproved to return zero address
    function getApproved(uint256) public pure override(IERC721, ERC721) returns (address) {
        return address(0);
    }

    // Override isApprovedForAll to return false
    function isApprovedForAll(address, address) public pure override(IERC721, ERC721) returns (bool) {
        return false;
    }

    // Required overrides for multiple inheritance

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Get total number of receipts issued
     * @return Total supply of tax receipts
     */
    function totalReceipts() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Check if contract supports soul-bound functionality
     * @return True (always soul-bound)
     */
    function isSoulBound() external pure returns (bool) {
        return true;
    }
}
