// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./AccessRoles.sol";
import "./UrbanToken.sol";
import "./TaxModule.sol";
import "./GrievanceHub.sol";
import "./ProjectRegistry.sol";
import "./UrbanGovernor.sol";
import "./MetaForwarder.sol";
import "./TaxReceipt.sol";

/**
 * @title UrbanCore
 * @notice Central registry and orchestrator for UrbanDAO system with role-based onboarding
 * @dev UUPS upgradeable contract that wires all modules and manages citizen lifecycle
 */
contract UrbanCore is 
    Initializable,
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    ERC2771Context 
{
    using AccessRoles for bytes32;

    // Core system contracts
    UrbanToken public urbanToken;
    TaxModule public taxModule;
    GrievanceHub public grievanceHub;
    ProjectRegistry public projectRegistry;
    UrbanGovernor public urbanGovernor;
    UrbanTimelockController public timelock;
    MetaForwarder public metaForwarder;
    TaxReceipt public taxReceipt;
    address public treasury;

    // Role collision prevention
    mapping(address => bytes32) public addressRole;

    // Citizen onboarding
    struct CitizenRequest {
        address citizen;
        bytes32 docsHash;
        uint256 requestedAt;
        bool processed;
        address validator;
    }

    mapping(address => CitizenRequest) public citizenRequests;
    mapping(address => bool) public approvedCitizens;
    address[] public pendingRequests;

    // Area management
    mapping(uint256 => address) public areaHeads;
    mapping(address => uint256[]) public headAreas;

    // Events
    event CitizenRegistrationRequested(address indexed citizen, bytes32 docsHash);
    event CitizenApproved(address indexed citizen, address indexed validator, uint256 tokenReward);
    event CitizenRejected(address indexed citizen, address indexed validator, string reason);
    event RoleAssigned(address indexed account, bytes32 indexed role, address indexed assigner);
    event RoleRevoked(address indexed account, bytes32 indexed role, address indexed revoker);
    event TrustedForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event AreaHeadAssigned(uint256 indexed areaId, address indexed head);
    event SystemUpgraded(address indexed newImplementation, address indexed upgrader);

    // Custom errors
    error AddressAlreadyHasRole(address account, bytes32 existingRole);
    error CitizenRequestAlreadyExists(address citizen);
    error CitizenRequestNotFound(address citizen);
    error CitizenAlreadyApproved(address citizen);
    error InvalidContractAddress(address contractAddr);
    error RoleCollisionDetected(address account, bytes32 existing, bytes32 requested);
    error UnauthorizedUpgrade(address caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        _disableInitializers();
    }

    /**
     * @notice Initialize the UrbanCore contract
     * @param owner The owner address (will receive OWNER_ROLE)
     * @param _urbanToken Address of the UrbanToken contract
     * @param _taxModule Address of the TaxModule contract
     * @param _grievanceHub Address of the GrievanceHub contract
     * @param _projectRegistry Address of the ProjectRegistry contract
     * @param _urbanGovernor Address of the UrbanGovernor contract
     * @param _timelock Address of the TimelockController contract
     * @param _taxReceipt Address of the TaxReceipt contract
     * @param _treasury Address of the treasury
     */
    function initialize(
        address owner,
        address _urbanToken,
        address _taxModule,
        address _grievanceHub,
        address _projectRegistry,
        address payable _urbanGovernor,
        address payable _timelock,
        address _taxReceipt,
        address _treasury
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // Validate contract addresses
        if (_urbanToken == address(0)) revert InvalidContractAddress(_urbanToken);
        if (_taxModule == address(0)) revert InvalidContractAddress(_taxModule);
        if (_grievanceHub == address(0)) revert InvalidContractAddress(_grievanceHub);
        if (_projectRegistry == address(0)) revert InvalidContractAddress(_projectRegistry);
        if (_urbanGovernor == address(0)) revert InvalidContractAddress(_urbanGovernor);
        if (_timelock == address(0)) revert InvalidContractAddress(_timelock);
        if (_taxReceipt == address(0)) revert InvalidContractAddress(_taxReceipt);
        if (_treasury == address(0)) revert InvalidContractAddress(_treasury);

        // Set contract references
        urbanToken = UrbanToken(_urbanToken);
        taxModule = TaxModule(_taxModule);
        grievanceHub = GrievanceHub(_grievanceHub);
        projectRegistry = ProjectRegistry(_projectRegistry);
        urbanGovernor = UrbanGovernor(_urbanGovernor);
        timelock = UrbanTimelockController(_timelock);
        taxReceipt = TaxReceipt(_taxReceipt);
        treasury = _treasury;

        // Set up role hierarchy
        _grantRole(AccessRoles.OWNER_ROLE, owner);
        _setRoleAdmin(AccessRoles.OWNER_ROLE, AccessRoles.OWNER_ROLE);
        _setRoleAdmin(AccessRoles.ADMIN_GOVT_ROLE, AccessRoles.OWNER_ROLE);
        _setRoleAdmin(AccessRoles.ADMIN_HEAD_ROLE, AccessRoles.ADMIN_GOVT_ROLE);
        _setRoleAdmin(AccessRoles.VALIDATOR_ROLE, AccessRoles.ADMIN_HEAD_ROLE);
        _setRoleAdmin(AccessRoles.TAX_COLLECTOR_ROLE, AccessRoles.ADMIN_HEAD_ROLE);
        _setRoleAdmin(AccessRoles.PROJECT_MANAGER_ROLE, AccessRoles.ADMIN_HEAD_ROLE);
        _setRoleAdmin(AccessRoles.CITIZEN_ROLE, AccessRoles.VALIDATOR_ROLE);
        _setRoleAdmin(AccessRoles.TX_PAYER_ROLE, AccessRoles.OWNER_ROLE);

        // Record owner's role
        addressRole[owner] = AccessRoles.OWNER_ROLE;
    }

    /**
     * @notice Request citizen registration (gasless via ERC-2771)
     * @param docsHash IPFS hash of KYC documents
     */
    function registerCitizen(bytes32 docsHash) external whenNotPaused {
        address citizen = _msgSender(); // ERC-2771 context
        
        if (citizenRequests[citizen].citizen != address(0)) revert CitizenRequestAlreadyExists(citizen);
        if (approvedCitizens[citizen]) revert CitizenAlreadyApproved(citizen);

        citizenRequests[citizen] = CitizenRequest({
            citizen: citizen,
            docsHash: docsHash,
            requestedAt: block.timestamp,
            processed: false,
            validator: address(0)
        });

        pendingRequests.push(citizen);

        emit CitizenRegistrationRequested(citizen, docsHash);
    }

    /**
     * @notice Approve a citizen registration
     * @param citizen The citizen address to approve
     */
    function approveCitizen(address citizen) external onlyRole(AccessRoles.VALIDATOR_ROLE) whenNotPaused nonReentrant {
        CitizenRequest storage request = citizenRequests[citizen];
        if (request.citizen == address(0)) revert CitizenRequestNotFound(citizen);
        if (approvedCitizens[citizen]) revert CitizenAlreadyApproved(citizen);

        // Check role collision before granting CITIZEN_ROLE
        bytes32 existingRole = addressRole[citizen];
        if (AccessRoles.wouldCollide(existingRole, AccessRoles.CITIZEN_ROLE)) {
            revert RoleCollisionDetected(citizen, existingRole, AccessRoles.CITIZEN_ROLE);
        }

        // Process the request
        request.processed = true;
        request.validator = _msgSender();
        approvedCitizens[citizen] = true;

        // Grant CITIZEN_ROLE
        _grantRole(AccessRoles.CITIZEN_ROLE, citizen);
        addressRole[citizen] = AccessRoles.CITIZEN_ROLE;

        // Mint onboarding reward
        uint256 rewardAmount = urbanToken.ONBOARDING_REWARD();
        urbanToken.mintOnboard(citizen, rewardAmount);

        emit CitizenApproved(citizen, _msgSender(), rewardAmount);
        emit RoleAssigned(citizen, AccessRoles.CITIZEN_ROLE, _msgSender());
    }

    /**
     * @notice Reject a citizen registration
     * @param citizen The citizen address to reject
     * @param reason The reason for rejection
     */
    function rejectCitizen(address citizen, string calldata reason) 
        external 
        onlyRole(AccessRoles.VALIDATOR_ROLE) 
        whenNotPaused 
    {
        CitizenRequest storage request = citizenRequests[citizen];
        if (request.citizen == address(0)) revert CitizenRequestNotFound(citizen);

        request.processed = true;
        request.validator = _msgSender();

        emit CitizenRejected(citizen, _msgSender(), reason);
    }

    /**
     * @notice Assign a role with collision prevention
     * @param role The role to assign
     * @param account The account to assign the role to
     */
    function assignRole(bytes32 role, address account) external whenNotPaused {
        // Check authorization
        if (!AccessRoles.isAuthorizedToAssign(_msgSender(), role, this.hasRole)) {
            revert("UrbanCore: unauthorized to assign role");
        }

        // Check role collision
        bytes32 existingRole = addressRole[account];
        if (AccessRoles.wouldCollide(existingRole, role)) {
            revert RoleCollisionDetected(account, existingRole, role);
        }

        // Grant role and update tracking
        _grantRole(role, account);
        if (role != AccessRoles.CITIZEN_ROLE) {
            addressRole[account] = role;
        }

        emit RoleAssigned(account, role, _msgSender());
    }

    /**
     * @notice Revoke a role
     * @param role The role to revoke
     * @param account The account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.revokeRole(role, account);
        
        // Clear role tracking if not citizen role
        if (role != AccessRoles.CITIZEN_ROLE) {
            delete addressRole[account];
        }

        emit RoleRevoked(account, role, _msgSender());
    }

    /**
     * @notice Assign area head
     * @param areaId The area ID
     * @param head The address to assign as area head
     */
    function assignAreaHead(uint256 areaId, address head) 
        external 
        onlyRole(AccessRoles.ADMIN_GOVT_ROLE) 
        whenNotPaused 
    {
        // Ensure the address has ADMIN_HEAD_ROLE
        if (!hasRole(AccessRoles.ADMIN_HEAD_ROLE, head)) {
            _grantRole(AccessRoles.ADMIN_HEAD_ROLE, head);
        }

        areaHeads[areaId] = head;
        headAreas[head].push(areaId);

        emit AreaHeadAssigned(areaId, head);
    }

    /**
     * @notice Set trusted forwarder (timelocked)
     * @param newForwarder The new trusted forwarder address
     */
    function setTrustedForwarder(address newForwarder) external onlyRole(AccessRoles.OWNER_ROLE) {
        address oldForwarder = address(0); // Placeholder for old forwarder
        // In a real implementation, this would update the forwarder
        // For now, emit event for tracking
        emit TrustedForwarderUpdated(oldForwarder, newForwarder);
    }

    /**
     * @notice Pause all contract functionality
     */
    function pause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause all contract functionality
     */
    function unpause() external onlyRole(AccessRoles.OWNER_ROLE) {
        _unpause();
    }

    // View functions

    /**
     * @notice Get pending citizen requests
     * @return Array of addresses with pending requests
     */
    function getPendingRequests() external view returns (address[] memory) {
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < pendingRequests.length; i++) {
            if (!citizenRequests[pendingRequests[i]].processed) {
                pendingCount++;
            }
        }

        address[] memory pending = new address[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < pendingRequests.length; i++) {
            if (!citizenRequests[pendingRequests[i]].processed) {
                pending[index] = pendingRequests[i];
                index++;
            }
        }

        return pending;
    }

    /**
     * @notice Get citizen request details
     * @param citizen The citizen address
     * @return CitizenRequest struct
     */
    function getCitizenRequest(address citizen) external view returns (CitizenRequest memory) {
        return citizenRequests[citizen];
    }

    /**
     * @notice Get areas managed by a head
     * @param head The head address
     * @return Array of area IDs
     */
    function getHeadAreas(address head) external view returns (uint256[] memory) {
        return headAreas[head];
    }

    /**
     * @notice Get area head for a specific area
     * @param areaId The area ID
     * @return Head address for the area
     */
    function getAreaHead(uint256 areaId) external view returns (address) {
        return areaHeads[areaId];
    }

    /**
     * @notice Get role assigned to an address
     * @param account The account to check
     * @return The role bytes32 (returns 0x0 if no privileged role)
     */
    function getAddressRole(address account) external view returns (bytes32) {
        return addressRole[account];
    }

    /**
     * @notice Check if an address is an approved citizen
     * @param citizen The address to check
     * @return True if citizen is approved
     */
    function isApprovedCitizen(address citizen) external view returns (bool) {
        return approvedCitizens[citizen];
    }

    /**
     * @notice Check if an address has a specific role
     * @param role The role to check
     * @param account The address to check
     * @return Boolean indicating if the address has the role
     */
    function checkRole(bytes32 role, address account) external view returns (bool) {
        return hasRole(role, account);
    }

    // UUPS upgrade authorization
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(AccessRoles.OWNER_ROLE) {
        emit SystemUpgraded(newImplementation, _msgSender());
    }

    // ERC2771Context overrides
    function _msgSender() internal view override(ContextUpgradeable, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    // Context override for upgradeable contracts
    function _contextSuffixLength() internal view override(ContextUpgradeable, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    /**
     * @notice Get contract version for upgrade tracking
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @notice Check if the contract supports an interface
     * @param interfaceId The interface identifier
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(AccessControlUpgradeable) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
