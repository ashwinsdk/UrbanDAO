// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AccessRoles.sol";

/**
 * @title ProjectRegistry
 * @notice Tracks project lifecycle from proposal to completion with escrow functionality
 * @dev Manages project funding, milestones, and completion tracking for UrbanDAO
 */
contract ProjectRegistry is AccessControl, Pausable, ReentrancyGuard {
    using AccessRoles for bytes32;

    // Project status enum (packed as uint8)
    enum Status {
        Proposed,    // 0
        Funded,      // 1
        InProgress,  // 2
        Completed,   // 3
        Cancelled    // 4
    }

    // Project data structure (packed for gas efficiency)
    struct Project {
        uint256 id;
        uint256 areaId;
        bytes32 titleHash;           // IPFS hash of project title
        bytes32 descriptionHash;     // IPFS hash of project description
        address manager;
        uint256 fundingGoal;
        uint256 escrowed;           // Total funds escrowed
        uint256 released;           // Total funds released to manager
        Status status;              // Current project status
        uint8 milestoneCount;       // Total number of milestones
        uint8 currentMilestone;     // Current milestone being worked on
        uint256 citizenUpvotes;     // Number of citizen upvotes
        uint256 createdAt;          // Timestamp of creation
    }

    // Milestone data structure
    struct Milestone {
        uint256 projectId;
        uint8 milestoneNumber;
        bytes32 proofHash;          // IPFS hash of completion proof
        uint256 amount;             // Amount to be released for this milestone
        bool completed;
        uint256 completedAt;
        address submittedBy;
    }

    // State variables
    uint256 private _nextProjectId;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint8 => Milestone)) public milestones;
    mapping(uint256 => uint256[]) public areaProjects;
    mapping(address => uint256[]) public managerProjects;
    mapping(uint256 => mapping(address => bool)) public projectUpvotes;

    // Treasury address for fund management
    address public treasury;

    // Events
    event ProjectCreated(
        uint256 indexed projectId,
        uint256 indexed areaId,
        address indexed manager,
        bytes32 titleHash,
        uint256 fundingGoal
    );
    
    event ProjectFunded(
        uint256 indexed projectId,
        uint256 amount,
        address indexed funder
    );
    
    event MilestoneSubmitted(
        uint256 indexed projectId,
        uint8 indexed milestoneNumber,
        bytes32 proofHash,
        uint256 amount,
        address indexed manager
    );
    
    event ProjectCompleted(
        uint256 indexed projectId,
        address indexed manager,
        uint256 totalReleased
    );
    
    event ProjectCancelled(
        uint256 indexed projectId,
        string reason
    );
    
    event CitizenUpvote(
        uint256 indexed projectId,
        address indexed citizen
    );

    // Custom errors
    error ProjectNotFound(uint256 projectId);
    error UnauthorizedManager(address caller, address expectedManager);
    error InvalidProjectStatus(Status current, Status required);
    error InsufficientFunding(uint256 available, uint256 required);
    error MilestoneAlreadyCompleted(uint256 projectId, uint8 milestoneNumber);
    error InvalidMilestone(uint256 projectId, uint8 milestoneNumber);
    error AlreadyUpvoted(address citizen, uint256 projectId);
    error InvalidAmount(uint256 amount);
    error TreasuryNotSet();

    constructor(address owner, address _treasury) {
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        treasury = _treasury;
        _nextProjectId = 1;
    }

    /**
     * @notice Create a new project proposal
     * @param areaId The area ID where the project will be implemented
     * @param titleHash IPFS hash of the project title
     * @param descriptionHash IPFS hash of the project description
     * @param manager The project manager address
     * @param fundingGoal The total funding required for the project
     * @return projectId The ID of the created project
     */
    function createProject(
        uint256 areaId,
        bytes32 titleHash,
        bytes32 descriptionHash,
        address manager,
        uint256 fundingGoal
    ) external onlyRole(AccessRoles.ADMIN_HEAD_ROLE) whenNotPaused returns (uint256) {
        if (fundingGoal == 0) revert InvalidAmount(fundingGoal);
        if (manager == address(0)) revert UnauthorizedManager(address(0), manager);

        uint256 projectId = _nextProjectId++;

        projects[projectId] = Project({
            id: projectId,
            areaId: areaId,
            titleHash: titleHash,
            descriptionHash: descriptionHash,
            manager: manager,
            fundingGoal: fundingGoal,
            escrowed: 0,
            released: 0,
            status: Status.Proposed,
            milestoneCount: 0,
            currentMilestone: 1,
            citizenUpvotes: 0,
            createdAt: block.timestamp
        });

        areaProjects[areaId].push(projectId);
        managerProjects[manager].push(projectId);

        emit ProjectCreated(projectId, areaId, manager, titleHash, fundingGoal);
        return projectId;
    }

    /**
     * @notice Fund a project (called by Timelock upon successful DAO proposal)
     * @param projectId The ID of the project to fund
     */
    function fundProject(uint256 projectId) external payable onlyRole(AccessRoles.OWNER_ROLE) whenNotPaused {
        Project storage project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        if (project.status != Status.Proposed) revert InvalidProjectStatus(project.status, Status.Proposed);
        if (msg.value < project.fundingGoal) revert InsufficientFunding(msg.value, project.fundingGoal);

        project.escrowed = msg.value;
        project.status = Status.Funded;

        emit ProjectFunded(projectId, msg.value, _msgSender());
    }

    /**
     * @notice Submit milestone completion proof and request fund release
     * @param projectId The ID of the project
     * @param proofHash IPFS hash of the milestone completion proof
     * @param amount The amount requested for this milestone
     */
    function submitMilestone(
        uint256 projectId,
        bytes32 proofHash,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Project storage project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        if (_msgSender() != project.manager) revert UnauthorizedManager(_msgSender(), project.manager);
        if (project.status != Status.Funded && project.status != Status.InProgress) {
            revert InvalidProjectStatus(project.status, Status.InProgress);
        }
        if (amount == 0) revert InvalidAmount(amount);
        if (project.released + amount > project.escrowed) {
            revert InsufficientFunding(project.escrowed - project.released, amount);
        }

        uint8 milestoneNumber = project.currentMilestone;
        if (milestones[projectId][milestoneNumber].completed) {
            revert MilestoneAlreadyCompleted(projectId, milestoneNumber);
        }

        // Record milestone
        milestones[projectId][milestoneNumber] = Milestone({
            projectId: projectId,
            milestoneNumber: milestoneNumber,
            proofHash: proofHash,
            amount: amount,
            completed: true,
            completedAt: block.timestamp,
            submittedBy: _msgSender()
        });

        // Update project state
        project.released += amount;
        project.currentMilestone++;
        if (project.milestoneCount == 0) project.milestoneCount = 1;
        else project.milestoneCount++;

        if (project.status == Status.Funded) {
            project.status = Status.InProgress;
        }

        // Transfer funds to manager
        (bool success, ) = payable(project.manager).call{value: amount}("");
        require(success, "Transfer failed");

        emit MilestoneSubmitted(projectId, milestoneNumber, proofHash, amount, project.manager);
    }

    /**
     * @notice Mark project as completed
     * @param projectId The ID of the project to mark as completed
     */
    function markCompleted(uint256 projectId) external onlyRole(AccessRoles.ADMIN_HEAD_ROLE) whenNotPaused {
        Project storage project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        if (project.status != Status.InProgress) revert InvalidProjectStatus(project.status, Status.InProgress);

        project.status = Status.Completed;

        emit ProjectCompleted(projectId, project.manager, project.released);
    }

    /**
     * @notice Cancel a project and refund remaining funds
     * @param projectId The ID of the project to cancel
     * @param reason The reason for cancellation
     */
    function cancelProject(uint256 projectId, string calldata reason) 
        external 
        onlyRole(AccessRoles.ADMIN_HEAD_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        Project storage project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        if (project.status == Status.Completed || project.status == Status.Cancelled) {
            revert InvalidProjectStatus(project.status, Status.InProgress);
        }

        uint256 remainingFunds = project.escrowed - project.released;
        project.status = Status.Cancelled;

        // Refund remaining funds to treasury
        if (remainingFunds > 0 && treasury != address(0)) {
            (bool success, ) = payable(treasury).call{value: remainingFunds}("");
            require(success, "Refund failed");
        }

        emit ProjectCancelled(projectId, reason);
    }

    /**
     * @notice Allow citizens to upvote projects
     * @param projectId The ID of the project to upvote
     */
    function upvoteProject(uint256 projectId) external onlyRole(AccessRoles.CITIZEN_ROLE) whenNotPaused {
        Project storage project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        if (projectUpvotes[projectId][_msgSender()]) revert AlreadyUpvoted(_msgSender(), projectId);

        projectUpvotes[projectId][_msgSender()] = true;
        project.citizenUpvotes++;

        emit CitizenUpvote(projectId, _msgSender());
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
     * @notice Get project details
     * @param projectId The ID of the project
     * @return Project data structure
     */
    function getProject(uint256 projectId) external view returns (Project memory) {
        if (projects[projectId].id == 0) revert ProjectNotFound(projectId);
        return projects[projectId];
    }

    /**
     * @notice Get milestone details
     * @param projectId The ID of the project
     * @param milestoneNumber The milestone number
     * @return Milestone data structure
     */
    function getMilestone(uint256 projectId, uint8 milestoneNumber) external view returns (Milestone memory) {
        return milestones[projectId][milestoneNumber];
    }

    /**
     * @notice Get all projects in an area
     * @param areaId The area ID
     * @return Array of project IDs
     */
    function getAreaProjects(uint256 areaId) external view returns (uint256[] memory) {
        return areaProjects[areaId];
    }

    /**
     * @notice Get all projects managed by an address
     * @param manager The manager address
     * @return Array of project IDs
     */
    function getManagerProjects(address manager) external view returns (uint256[] memory) {
        return managerProjects[manager];
    }

    /**
     * @notice Check if a citizen has upvoted a project
     * @param projectId The project ID
     * @param citizen The citizen address
     * @return True if the citizen has upvoted the project
     */
    function hasUpvoted(uint256 projectId, address citizen) external view returns (bool) {
        return projectUpvotes[projectId][citizen];
    }

    /**
     * @notice Get total number of projects
     * @return Total number of projects created
     */
    function getTotalProjects() external view returns (uint256) {
        return _nextProjectId - 1;
    }

    /**
     * @notice Get remaining funds in a project
     * @param projectId The project ID
     * @return Remaining escrowed funds
     */
    function getRemainingFunds(uint256 projectId) external view returns (uint256) {
        Project memory project = projects[projectId];
        if (project.id == 0) revert ProjectNotFound(projectId);
        return project.escrowed - project.released;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
