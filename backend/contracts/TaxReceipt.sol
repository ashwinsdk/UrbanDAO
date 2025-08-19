// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./AccessRoles.sol";

/**
 * @title TaxReceipt
 * @notice Soul-bound ERC721 NFT representing tax payment receipts
 * @dev Non-transferable NFTs that prove tax compliance for citizens with metadata support
 */
contract TaxReceipt is ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl, Pausable {
    
    // Override required for ERC721Enumerable and ERC721URIStorage
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

    // Base URI for IPFS gateway to resolve CIDs
    string private _baseTokenURI = "ipfs://"; 
    
    // Default image CID to be used for receipts
    string public defaultImageCID = "bafybeihnesjjdqhqvlnei5kep52tqv6zv3k7nposxaqfdwzlkgh6zorxtu";
    
    /**
     * @notice Set the base URI for token metadata
     * @param baseURI The new base URI
     * @dev Only callable by OWNER_ROLE
     */
    function setBaseURI(string memory baseURI) external onlyRole(AccessRoles.OWNER_ROLE) {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @notice Set the default image CID for receipts
     * @param newCID The new IPFS CID for the default receipt image
     * @dev Only callable by OWNER_ROLE
     */
    function setDefaultImageCID(string memory newCID) external onlyRole(AccessRoles.OWNER_ROLE) {
        defaultImageCID = newCID;
    }
    
    /**
     * @notice Get base URI for token metadata
     * @return Base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @notice Generate the name for a receipt token
     * @param tokenId The token ID
     * @param year The tax year
     * @return The generated name
     */
    function _generateTokenName(uint256 tokenId, uint256 year) internal pure returns (string memory) {
        return string(abi.encodePacked("Tax Receipt #", toString(tokenId), " - ", toString(year)));
    }
    
    /**
     * @notice Generate the description for a receipt token
     * @param year The tax year
     * @param amount The tax amount
     * @param timestamp The timestamp
     * @return The generated description
     */
    function _generateTokenDescription(uint256 year, uint256 amount, uint256 timestamp) internal pure returns (string memory) {
        return string(abi.encodePacked(
            "Official tax payment receipt for ", 
            toString(year), 
            " - Amount: ", 
            formatAmount(amount), 
            " - Issued: ",
            formatTimestamp(timestamp)
        ));
    }
    
    /**
     * @notice Generate attributes section for metadata
     * @param year The tax year
     * @param amount The tax amount
     * @param timestamp The timestamp
     * @param docsHash The document hash
     * @return The attributes JSON section
     */
    function _generateAttributes(uint256 year, uint256 amount, uint256 timestamp, bytes32 docsHash) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"trait_type": "Year", "value": "', toString(year), '"}, ',
            '{"trait_type": "Amount", "value": "', formatAmount(amount), '"}, ',
            '{"trait_type": "Timestamp", "value": "', formatTimestamp(timestamp), '"}, ',
            '{"trait_type": "Document Hash", "value": "', bytes32ToString(docsHash), '"}'
        ));
    }

    /**
     * @notice Generate on-chain metadata for a receipt token
     * @param tokenId The token ID
     * @return JSON metadata for the token
     */
    function generateTokenMetadata(uint256 tokenId) public view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "TaxReceipt: token does not exist");
        
        Receipt memory receipt = receipts[tokenId];
        
        // Generate components
        string memory receiptName = _generateTokenName(tokenId, receipt.year);
        string memory description = _generateTokenDescription(receipt.year, receipt.amount, receipt.timestamp);
        string memory attributes = _generateAttributes(receipt.year, receipt.amount, receipt.timestamp, receipt.docsHash);
        
        // Create JSON metadata
        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{',
            '"name": "', receiptName, '", ',
            '"description": "', description, '", ',
            '"image": "ipfs://', defaultImageCID, '", ',
            '"attributes": [', attributes, ']',
            '}'
        ))));
        
        return string(abi.encodePacked('data:application/json;base64,', json));
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
        
        // Set token URI with dynamically generated metadata
        _setTokenURI(tokenId, generateTokenMetadata(tokenId));

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
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
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
    
    /**
     * @notice Convert a uint256 to string
     * @param value The uint256 value
     * @return String representation
     */
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    /**
     * @notice Format an amount with decimal places
     * @param amount The amount to format
     * @return Formatted amount as string
     */
    function formatAmount(uint256 amount) internal pure returns (string memory) {
        // Format as ether units (assuming amount is in wei)
        uint256 eth = amount / 1e18;
        uint256 decimals = (amount % 1e18) / 1e16; // Get 2 decimal places
        
        if (decimals > 0) {
            return string(abi.encodePacked(toString(eth), ".", toString(decimals), " ETH"));
        } else {
            return string(abi.encodePacked(toString(eth), " ETH"));
        }
    }
    
    /**
     * @notice Format a timestamp as a readable date string
     * @param timestamp The timestamp to format
     * @return Formatted timestamp as string
     */
    function formatTimestamp(uint256 timestamp) internal pure returns (string memory) {
        // Simple timestamp string (can be improved with date formatting in production)
        return toString(timestamp);
    }
    
    /**
     * @notice Convert bytes32 to hex string
     * @param data The bytes32 data
     * @return Hex string
     */
    function bytes32ToString(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(64);
        
        for (uint256 i = 0; i < 32; i++) {
            result[i*2] = hexChars[uint8(data[i] >> 4)];
            result[i*2+1] = hexChars[uint8(data[i] & 0x0f)];
        }
        
        return string(result);
    }
}
