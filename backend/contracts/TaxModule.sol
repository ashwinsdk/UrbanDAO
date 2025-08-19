// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./AccessRoles.sol";
import "./TaxReceipt.sol";
import "./UrbanToken.sol";

/**
 * @title TaxModule
 * @notice Handles tax assessments and payments with gasless transactions via ERC-2771
 * @dev Integrates with TaxReceipt NFTs and supports objections and meeting scheduling
 */
contract TaxModule is AccessControl, Pausable, ReentrancyGuard, ERC2771Context {
    
    // Override required for ERC2771Context
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
    using AccessRoles for bytes32;

    // Assessment data structure
    struct Assessment {
        uint256 amount;
        bytes32 docsHash;           // IPFS hash of assessment documents
        address assessedBy;         // Tax collector who made the assessment
        bool paid;
        uint256 paidAt;
        bytes32 objectionHash;      // IPFS hash of objection documents (if any)
        bool objectionFiled;
        uint256 meetingTimestamp;   // Scheduled meeting timestamp (if any)
    }

    // State variables
    mapping(address => mapping(uint256 => Assessment)) public assessments; // citizen => year => assessment
    mapping(address => uint256[]) public citizenTaxYears;
    mapping(uint256 => address[]) public yearCitizens; // year => citizens with assessments
    
    TaxReceipt public immutable taxReceipt;
    UrbanToken public immutable urbanToken;
    address public treasury;

    // Events
    event TaxAssessed(
        address indexed citizen,
        uint256 indexed year,
        uint256 amount,
        bytes32 docsHash,
        address indexed assessor
    );
    
    event TaxPaid(
        address indexed citizen,
        uint256 indexed year,
        uint256 amount,
        uint256 receiptTokenId
    );
    
    event ObjectionFiled(
        address indexed citizen,
        uint256 indexed year,
        bytes32 reasonHash
    );
    
    event MeetingScheduled(
        address indexed citizen,
        uint256 indexed year,
        uint256 timestamp,
        address indexed scheduler
    );

    // Custom errors
    error AssessmentNotFound(address citizen, uint256 year);
    error AssessmentAlreadyPaid(address citizen, uint256 year);
    error AssessmentAlreadyExists(address citizen, uint256 year);
    error InvalidYear(uint256 year);
    error InvalidAmount(uint256 amount);
    error InsufficientTokenBalance(address citizen, uint256 balance, uint256 required);
    error TreasuryNotSet();
    error ObjectionAlreadyFiled(address citizen, uint256 year);
    error MeetingAlreadyScheduled(address citizen, uint256 year);
    error InvalidMeetingTime(uint256 timestamp);

    constructor(
        address owner,
        address _taxReceipt,
        address _urbanToken,
        address _treasury,
        address trustedForwarder
    ) ERC2771Context(trustedForwarder) {
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        
        taxReceipt = TaxReceipt(_taxReceipt);
        urbanToken = UrbanToken(_urbanToken);
        treasury = _treasury;
    }

    /**
     * @notice Assess tax for a citizen for a specific year
     * @param citizen The citizen to assess
     * @param year The tax year
     * @param amount The tax amount
     * @param docsHash IPFS hash of assessment documents
     */
    function assess(
        address citizen,
        uint256 year,
        uint256 amount,
        bytes32 docsHash
    ) external onlyRole(AccessRoles.TAX_COLLECTOR_ROLE) whenNotPaused {
        if (year < 2020 || year > 2100) revert InvalidYear(year);
        if (amount == 0) revert InvalidAmount(amount);
        if (assessments[citizen][year].amount > 0) revert AssessmentAlreadyExists(citizen, year);

        assessments[citizen][year] = Assessment({
            amount: amount,
            docsHash: docsHash,
            assessedBy: _msgSender(),
            paid: false,
            paidAt: 0,
            objectionHash: bytes32(0),
            objectionFiled: false,
            meetingTimestamp: 0
        });

        citizenTaxYears[citizen].push(year);
        yearCitizens[year].push(citizen);

        emit TaxAssessed(citizen, year, amount, docsHash, _msgSender());
    }

    /**
     * @notice Pay tax for a specific year (gasless via ERC-2771)
     * @param year The tax year to pay for
     * @dev Uses _msgSender() from ERC2771Context to get the actual citizen address
     */
    function payTax(uint256 year) external nonReentrant whenNotPaused {
        address citizen = _msgSender(); // ERC-2771 context provides the real sender
        Assessment storage assessment = assessments[citizen][year];
        
        if (assessment.amount == 0) revert AssessmentNotFound(citizen, year);
        if (assessment.paid) revert AssessmentAlreadyPaid(citizen, year);
        if (treasury == address(0)) revert TreasuryNotSet();

        uint256 citizenBalance = urbanToken.balanceOf(citizen);
        if (citizenBalance < assessment.amount) {
            revert InsufficientTokenBalance(citizen, citizenBalance, assessment.amount);
        }

        // Mark as paid
        assessment.paid = true;
        assessment.paidAt = block.timestamp;

        // Transfer tokens from citizen to treasury
        urbanToken.transferFrom(citizen, treasury, assessment.amount);

        // Mint tax receipt NFT
        uint256 receiptTokenId = _mintTaxReceipt(citizen, year, assessment.amount, assessment.docsHash);

        emit TaxPaid(citizen, year, assessment.amount, receiptTokenId);
    }

    /**
     * @notice File an objection to a tax assessment
     * @param year The tax year to object to
     * @param reasonHash IPFS hash of objection reason documents
     */
    function objectAssessment(uint256 year, bytes32 reasonHash) external whenNotPaused {
        address citizen = _msgSender();
        Assessment storage assessment = assessments[citizen][year];
        
        if (assessment.amount == 0) revert AssessmentNotFound(citizen, year);
        if (assessment.objectionFiled) revert ObjectionAlreadyFiled(citizen, year);
        if (assessment.paid) revert AssessmentAlreadyPaid(citizen, year);

        assessment.objectionFiled = true;
        assessment.objectionHash = reasonHash;

        emit ObjectionFiled(citizen, year, reasonHash);
    }

    /**
     * @notice Schedule a meeting for tax discussion
     * @param citizen The citizen to schedule meeting with
     * @param year The tax year for discussion
     * @param timestamp The meeting timestamp
     */
    function scheduleMeeting(
        address citizen,
        uint256 year,
        uint256 timestamp
    ) external onlyRole(AccessRoles.TAX_COLLECTOR_ROLE) whenNotPaused {
        Assessment storage assessment = assessments[citizen][year];
        
        if (assessment.amount == 0) revert AssessmentNotFound(citizen, year);
        if (assessment.meetingTimestamp > 0) revert MeetingAlreadyScheduled(citizen, year);
        if (timestamp <= block.timestamp) revert InvalidMeetingTime(timestamp);

        assessment.meetingTimestamp = timestamp;

        emit MeetingScheduled(citizen, year, timestamp, _msgSender());
    }

    /**
     * @notice Internal function to mint tax receipt NFT
     * @param citizen The citizen who paid tax
     * @param year The tax year
     * @param amount The amount paid
     * @param docsHash The assessment documents hash
     * @return tokenId The minted NFT token ID
     */
    function _mintTaxReceipt(
        address citizen,
        uint256 year,
        uint256 amount,
        bytes32 docsHash
    ) internal returns (uint256) {
        // This requires TaxReceipt contract to grant minting role to this contract
        taxReceipt.safeMintReceipt(citizen, year, amount, docsHash);
        return taxReceipt.getReceiptTokenId(citizen, year);
    }

    /**
     * @notice Set treasury address
     * @param _treasury The new treasury address
     */
    function setTreasury(address _treasury) external onlyRole(AccessRoles.OWNER_ROLE) {
        treasury = _treasury;
    }

    /**
     * @notice Pause contract functionality
     */
    function pause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract functionality
     */
    function unpause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _unpause();
    }

    // View functions

    /**
     * @notice Get assessment details for a citizen and year
     * @param citizen The citizen address
     * @param year The tax year
     * @return Assessment data structure
     */
    function getAssessment(address citizen, uint256 year) external view returns (Assessment memory) {
        return assessments[citizen][year];
    }

    /**
     * @notice Get all tax years for a citizen
     * @param citizen The citizen address
     * @return Array of years with assessments
     */
    function getCitizenTaxYears(address citizen) external view returns (uint256[] memory) {
        return citizenTaxYears[citizen];
    }

    /**
     * @notice Get all citizens with assessments for a specific year
     * @param year The tax year
     * @return Array of citizen addresses
     */
    function getYearCitizens(uint256 year) external view returns (address[] memory) {
        return yearCitizens[year];
    }

    /**
     * @notice Check if a citizen has paid tax for a specific year
     * @param citizen The citizen address
     * @param year The tax year
     * @return True if tax is paid
     */
    function hasPaidTax(address citizen, uint256 year) external view returns (bool) {
        return assessments[citizen][year].paid;
    }

    /**
     * @notice Check if a citizen has an objection for a specific year
     * @param citizen The citizen address
     * @param year The tax year
     * @return True if objection is filed
     */
    function hasObjection(address citizen, uint256 year) external view returns (bool) {
        return assessments[citizen][year].objectionFiled;
    }

    /**
     * @notice Get outstanding tax amount for a citizen
     * @param citizen The citizen address
     * @return Total outstanding tax amount across all years
     */
    function getOutstandingTax(address citizen) external view returns (uint256) {
        uint256[] memory taxYears = citizenTaxYears[citizen];
        uint256 outstanding = 0;
        
        for (uint256 i = 0; i < taxYears.length; i++) {
            Assessment memory assessment = assessments[citizen][taxYears[i]];
            if (!assessment.paid) {
                outstanding += assessment.amount;
            }
        }
        
        return outstanding;
    }

    /**
     * @notice Get total tax collected for a specific year
     * @param year The tax year
     * @return Total amount collected
     */
    function getTotalCollected(uint256 year) external view returns (uint256) {
        address[] memory citizens = yearCitizens[year];
        uint256 total = 0;
        
        for (uint256 i = 0; i < citizens.length; i++) {
            Assessment memory assessment = assessments[citizens[i]][year];
            if (assessment.paid) {
                total += assessment.amount;
            }
        }
        
        return total;
    }

    // ERC2771Context overrides
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
