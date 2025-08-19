// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./AccessRoles.sol";

/**
 * @title GrievanceHub
 * @notice Handles grievance filing, validation, review, and feedback with monthly limits
 * @dev Supports gasless transactions via ERC-2771 and escalation to AdminGovt
 */
contract GrievanceHub is AccessControl, Pausable, ERC2771Context {
    
    // Override required for ERC2771Context
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
    using AccessRoles for bytes32;

    // Grievance status enum (packed as uint8)
    enum Status {
        Pending,        // 0 - Initial state after filing
        Validated,      // 1 - Approved by validator
        Rejected,       // 2 - Rejected by validator
        AcceptedByHead, // 3 - Accepted by admin head for project creation
        InProject,      // 4 - Linked to a project
        Resolved,       // 5 - Marked as resolved
        Reopened        // 6 - Reopened due to citizen feedback
    }

    // Grievance data structure (packed for gas efficiency)
    struct Grievance {
        uint256 id;
        address citizen;
        uint256 areaId;
        bytes32 titleHash;          // IPFS hash of grievance title
        bytes32 bodyHash;           // IPFS hash of grievance body
        uint256 createdAt;
        Status status;
        address validator;          // Validator who processed the grievance
        address headReviewer;       // Admin head who reviewed
        uint8 disputeCount;         // Number of times reopened
        uint256 linkedProjectId;   // Project ID if linked to a project
    }

    // Feedback data structure
    struct Feedback {
        uint256 grievanceId;
        address citizen;
        bytes32 feedbackHash;       // IPFS hash of feedback content
        bool resolved;              // Whether citizen considers it resolved
        uint256 submittedAt;
        address validator;          // Validator who processed the feedback
        bool approved;              // Whether feedback was approved by validator
    }

    // State variables
    uint256 private _nextGrievanceId;
    mapping(uint256 => Grievance) public grievances;
    mapping(uint256 => Feedback[]) public grievanceFeedbacks;
    mapping(address => uint256[]) public citizenGrievances;
    mapping(uint256 => uint256[]) public areaGrievances;
    
    // Monthly limit tracking: citizen => yyyyMM => count
    mapping(address => mapping(uint256 => uint8)) public grievanceCountByMonth;
    
    // Constants
    uint8 public constant MAX_GRIEVANCES_PER_MONTH = 3;
    uint8 public constant MAX_DISPUTE_COUNT = 3;

    // Events
    event GrievanceFiled(
        uint256 indexed grievanceId,
        address indexed citizen,
        uint256 indexed areaId,
        bytes32 titleHash
    );
    
    event GrievanceValidated(
        uint256 indexed grievanceId,
        address indexed validator,
        bool approved
    );
    
    event GrievanceAccepted(
        uint256 indexed grievanceId,
        address indexed headReviewer
    );
    
    event GrievanceLinkedToProject(
        uint256 indexed grievanceId,
        uint256 indexed projectId
    );
    
    event FeedbackSubmitted(
        uint256 indexed grievanceId,
        address indexed citizen,
        bytes32 feedbackHash,
        bool resolved
    );
    
    event GrievanceReopened(
        uint256 indexed grievanceId,
        uint8 disputeCount
    );
    
    event EscalatedToAdminGovt(
        uint256 indexed grievanceId,
        uint8 disputeCount
    );

    // Custom errors
    error MonthlyLimitReached(address citizen, uint256 month, uint8 currentCount);
    error GrievanceNotFound(uint256 grievanceId);
    error UnauthorizedCitizen(address citizen, address expected);
    error InvalidStatus(Status current, Status required);
    error FeedbackAlreadySubmitted(uint256 grievanceId, address citizen);
    error DisputeLimitExceeded(uint256 grievanceId, uint8 count);
    error InvalidAreaId(uint256 areaId);
    error EmptyHash(bytes32 hash);

    constructor(address owner, address trustedForwarder) ERC2771Context(trustedForwarder) {
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        _nextGrievanceId = 1;
    }

    /**
     * @notice File a new grievance (gasless via ERC-2771)
     * @param areaId The area ID where the grievance occurred
     * @param titleHash IPFS hash of the grievance title
     * @param bodyHash IPFS hash of the grievance body/description
     * @return grievanceId The ID of the filed grievance
     */
    function fileGrievance(
        uint256 areaId,
        bytes32 titleHash,
        bytes32 bodyHash
    ) external whenNotPaused returns (uint256) {
        address citizen = _msgSender(); // ERC-2771 context provides the real sender
        
        if (areaId == 0) revert InvalidAreaId(areaId);
        if (titleHash == bytes32(0)) revert EmptyHash(titleHash);
        if (bodyHash == bytes32(0)) revert EmptyHash(bodyHash);

        // Check monthly limit
        uint256 currentMonth = _getCurrentMonth();
        uint8 currentCount = grievanceCountByMonth[citizen][currentMonth];
        if (currentCount >= MAX_GRIEVANCES_PER_MONTH) {
            revert MonthlyLimitReached(citizen, currentMonth, currentCount);
        }

        uint256 grievanceId = _nextGrievanceId++;
        
        grievances[grievanceId] = Grievance({
            id: grievanceId,
            citizen: citizen,
            areaId: areaId,
            titleHash: titleHash,
            bodyHash: bodyHash,
            createdAt: block.timestamp,
            status: Status.Pending,
            validator: address(0),
            headReviewer: address(0),
            disputeCount: 0,
            linkedProjectId: 0
        });

        // Update tracking
        grievanceCountByMonth[citizen][currentMonth]++;
        citizenGrievances[citizen].push(grievanceId);
        areaGrievances[areaId].push(grievanceId);

        emit GrievanceFiled(grievanceId, citizen, areaId, titleHash);
        return grievanceId;
    }

    /**
     * @notice Approve or reject a grievance
     * @param grievanceId The ID of the grievance to validate
     * @param approve Whether to approve (true) or reject (false) the grievance
     */
    function approveGrievance(uint256 grievanceId, bool approve) 
        external 
        onlyRole(AccessRoles.VALIDATOR_ROLE) 
        whenNotPaused 
    {
        Grievance storage grievance = grievances[grievanceId];
        if (grievance.id == 0) revert GrievanceNotFound(grievanceId);
        if (grievance.status != Status.Pending) revert InvalidStatus(grievance.status, Status.Pending);

        grievance.validator = _msgSender();
        grievance.status = approve ? Status.Validated : Status.Rejected;

        emit GrievanceValidated(grievanceId, _msgSender(), approve);
    }

    /**
     * @notice Accept a validated grievance for project creation
     * @param grievanceId The ID of the grievance to accept
     */
    function acceptValidated(uint256 grievanceId) 
        external 
        onlyRole(AccessRoles.ADMIN_HEAD_ROLE) 
        whenNotPaused 
    {
        Grievance storage grievance = grievances[grievanceId];
        if (grievance.id == 0) revert GrievanceNotFound(grievanceId);
        if (grievance.status != Status.Validated) revert InvalidStatus(grievance.status, Status.Validated);

        grievance.headReviewer = _msgSender();
        grievance.status = Status.AcceptedByHead;

        emit GrievanceAccepted(grievanceId, _msgSender());
    }

    /**
     * @notice Link a grievance to a project
     * @param grievanceId The ID of the grievance
     * @param projectId The ID of the created project
     * @dev Called by ProjectRegistry or UrbanCore when a project is created for this grievance
     */
    function linkToProject(uint256 grievanceId, uint256 projectId) 
        external 
        onlyRole(AccessRoles.ADMIN_HEAD_ROLE) 
        whenNotPaused 
    {
        Grievance storage grievance = grievances[grievanceId];
        if (grievance.id == 0) revert GrievanceNotFound(grievanceId);
        if (grievance.status != Status.AcceptedByHead) revert InvalidStatus(grievance.status, Status.AcceptedByHead);

        grievance.linkedProjectId = projectId;
        grievance.status = Status.InProject;

        emit GrievanceLinkedToProject(grievanceId, projectId);
    }

    /**
     * @notice Submit feedback for a grievance (gasless via ERC-2771)
     * @param grievanceId The ID of the grievance
     * @param feedbackHash IPFS hash of the feedback content
     * @param resolved Whether the citizen considers the issue resolved
     */
    function submitFeedback(
        uint256 grievanceId,
        bytes32 feedbackHash,
        bool resolved
    ) external whenNotPaused {
        address citizen = _msgSender(); // ERC-2771 context
        Grievance storage grievance = grievances[grievanceId];
        
        if (grievance.id == 0) revert GrievanceNotFound(grievanceId);
        if (grievance.citizen != citizen) revert UnauthorizedCitizen(citizen, grievance.citizen);
        if (grievance.status != Status.InProject && grievance.status != Status.Resolved) {
            revert InvalidStatus(grievance.status, Status.InProject);
        }
        if (feedbackHash == bytes32(0)) revert EmptyHash(feedbackHash);

        // Check if feedback already submitted for this grievance by this citizen
        Feedback[] storage feedbacks = grievanceFeedbacks[grievanceId];
        for (uint256 i = 0; i < feedbacks.length; i++) {
            if (feedbacks[i].citizen == citizen && !feedbacks[i].approved) {
                revert FeedbackAlreadySubmitted(grievanceId, citizen);
            }
        }

        // Add feedback
        grievanceFeedbacks[grievanceId].push(Feedback({
            grievanceId: grievanceId,
            citizen: citizen,
            feedbackHash: feedbackHash,
            resolved: resolved,
            submittedAt: block.timestamp,
            validator: address(0),
            approved: false
        }));

        // If not resolved, increment dispute count and potentially reopen
        if (!resolved) {
            grievance.disputeCount++;
            grievance.status = Status.Reopened;
            
            emit GrievanceReopened(grievanceId, grievance.disputeCount);
            
            // Escalate to AdminGovt if dispute count exceeds limit
            if (grievance.disputeCount > MAX_DISPUTE_COUNT) {
                emit EscalatedToAdminGovt(grievanceId, grievance.disputeCount);
            }
        } else {
            grievance.status = Status.Resolved;
        }

        emit FeedbackSubmitted(grievanceId, citizen, feedbackHash, resolved);
    }

    /**
     * @notice Approve or reject citizen feedback
     * @param grievanceId The ID of the grievance
     * @param feedbackIndex The index of the feedback to approve
     * @param approve Whether to approve the feedback
     */
    function approveFeedback(
        uint256 grievanceId,
        uint256 feedbackIndex,
        bool approve
    ) external onlyRole(AccessRoles.VALIDATOR_ROLE) whenNotPaused {
        Feedback[] storage feedbacks = grievanceFeedbacks[grievanceId];
        if (feedbackIndex >= feedbacks.length) revert FeedbackAlreadySubmitted(grievanceId, _msgSender());

        Feedback storage feedback = feedbacks[feedbackIndex];
        feedback.validator = _msgSender();
        feedback.approved = approve;
    }

    /**
     * @notice Mark a grievance as resolved (by admin head)
     * @param grievanceId The ID of the grievance to resolve
     */
    function markResolved(uint256 grievanceId) 
        external 
        onlyRole(AccessRoles.ADMIN_HEAD_ROLE) 
        whenNotPaused 
    {
        Grievance storage grievance = grievances[grievanceId];
        if (grievance.id == 0) revert GrievanceNotFound(grievanceId);
        
        grievance.status = Status.Resolved;
    }

    /**
     * @notice Get current month in YYYYMM format
     * @return Current month as uint256
     */
    function _getCurrentMonth() internal view returns (uint256) {
        // Simplified month calculation: year * 100 + month
        // In production, you might want to use a more robust date library
        uint256 timestamp = block.timestamp;
        uint256 year = 1970 + (timestamp / 365 days);
        uint256 month = ((timestamp % 365 days) / 30 days) + 1;
        return year * 100 + month;
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
     * @notice Get grievance details
     * @param grievanceId The ID of the grievance
     * @return Grievance data structure
     */
    function getGrievance(uint256 grievanceId) external view returns (Grievance memory) {
        if (grievances[grievanceId].id == 0) revert GrievanceNotFound(grievanceId);
        return grievances[grievanceId];
    }

    /**
     * @notice Get all grievances filed by a citizen
     * @param citizen The citizen address
     * @return Array of grievance IDs
     */
    function getCitizenGrievances(address citizen) external view returns (uint256[] memory) {
        return citizenGrievances[citizen];
    }

    /**
     * @notice Get all grievances in an area
     * @param areaId The area ID
     * @return Array of grievance IDs
     */
    function getAreaGrievances(uint256 areaId) external view returns (uint256[] memory) {
        return areaGrievances[areaId];
    }

    /**
     * @notice Get feedback for a grievance
     * @param grievanceId The ID of the grievance
     * @return Array of feedback structures
     */
    function getGrievanceFeedback(uint256 grievanceId) external view returns (Feedback[] memory) {
        return grievanceFeedbacks[grievanceId];
    }

    /**
     * @notice Get monthly grievance count for a citizen
     * @param citizen The citizen address
     * @param month The month in YYYYMM format
     * @return Number of grievances filed in that month
     */
    function getMonthlyCount(address citizen, uint256 month) external view returns (uint8) {
        return grievanceCountByMonth[citizen][month];
    }

    /**
     * @notice Get remaining grievances allowed for current month
     * @param citizen The citizen address
     * @return Number of grievances remaining for current month
     */
    function getRemainingMonthlyGrievances(address citizen) external view returns (uint8) {
        uint256 currentMonth = _getCurrentMonth();
        uint8 currentCount = grievanceCountByMonth[citizen][currentMonth];
        return MAX_GRIEVANCES_PER_MONTH - currentCount;
    }

    /**
     * @notice Get total number of grievances
     * @return Total grievances filed
     */
    function getTotalGrievances() external view returns (uint256) {
        return _nextGrievanceId - 1;
    }

    /**
     * @notice Check if a grievance has been escalated
     * @param grievanceId The ID of the grievance
     * @return True if dispute count exceeds maximum
     */
    function isEscalated(uint256 grievanceId) external view returns (bool) {
        Grievance memory grievance = grievances[grievanceId];
        return grievance.disputeCount > MAX_DISPUTE_COUNT;
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
