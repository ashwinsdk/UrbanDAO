# UrbanDAO Contract Function Signatures

This reference document compiles all function signatures from UrbanDAO smart contracts to facilitate frontend development and integration. Functions are organized by contract and include parameters, visibility, modifiers, and return types.

## Table of Contents
- [AccessRoles](#accessroles)
- [GrievanceHub](#grievancehub)
- [MetaForwarder](#metaforwarder)
- [ProjectRegistry](#projectregistry)
- [TaxModule](#taxmodule)
- [TaxReceipt](#taxreceipt)
- [UrbanCore](#urbancore)
- [UrbanGovernor](#urbangovernor)
- [UrbanToken](#urbantoken)

## AccessRoles

### Pure Functions

```solidity
function isPrivilegedRole(bytes32 role) internal pure returns (bool)
function wouldCollide(bytes32 existingRole, bytes32 newRole) internal pure returns (bool)
function getRoleAdmin(bytes32 role) internal pure returns (bytes32)
```

### Constants

```solidity
bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE")
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE")
bytes32 public constant AREA_HEAD_ROLE = keccak256("AREA_HEAD_ROLE")
bytes32 public constant TAX_ADMIN_ROLE = keccak256("TAX_ADMIN_ROLE")
bytes32 public constant PROJECT_ADMIN_ROLE = keccak256("PROJECT_ADMIN_ROLE")
bytes32 public constant GRIEVANCE_ADMIN_ROLE = keccak256("GRIEVANCE_ADMIN_ROLE")
bytes32 public constant CITIZEN_ROLE = keccak256("CITIZEN_ROLE")
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE")
```

## GrievanceHub

### Constructor

```solidity
constructor(address _urbanCore, address _trustedForwarder) ERC2771Context(_trustedForwarder) Pausable()
```

### State-Changing Functions

```solidity
function fileGrievance(string calldata _title, string calldata _description, uint8 _severityLevel, string calldata _ipfsHash) external whenNotPaused returns (uint256)
function validateGrievance(uint256 _grievanceId) external onlyRole(AccessRoles.GRIEVANCE_ADMIN_ROLE) whenNotPaused
function rejectGrievance(uint256 _grievanceId, string calldata _reason) external onlyRole(AccessRoles.GRIEVANCE_ADMIN_ROLE) whenNotPaused
function provideFeedback(uint256 _grievanceId, string calldata _feedback) external onlyRole(AccessRoles.GRIEVANCE_ADMIN_ROLE) whenNotPaused
function markAsResolved(uint256 _grievanceId) external onlyRole(AccessRoles.GRIEVANCE_ADMIN_ROLE) whenNotPaused
function escalateDispute(uint256 _grievanceId, string calldata _reason) external whenNotPaused
function updateMonthlyLimits(uint8 _severityLevel, uint256 _newLimit) external onlyRole(AccessRoles.OWNER_ROLE)
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function updateUrbanCore(address _newUrbanCore) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTrustedForwarder(address _trustedForwarder) external onlyRole(AccessRoles.OWNER_ROLE)
```

### View Functions

```solidity
function getGrievance(uint256 _grievanceId) external view returns (Grievance memory)
function getGrievancesByUser(address _user) external view returns (uint256[] memory)
function getGrievanceCount() external view returns (uint256)
function getGrievancesByStatus(GrievanceStatus _status) external view returns (uint256[] memory)
function getGrievancesByArea(bytes32 _areaId) external view returns (uint256[] memory)
function getGrievancesBySeverity(uint8 _severityLevel) external view returns (uint256[] memory)
function getUserMonthlyCount(address _user, uint8 _severityLevel) external view returns (uint256)
function isMsgSender(address _sender) internal view returns (address)
function _msgSender() internal view override(Context, ERC2771Context) returns (address)
function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata)
```

## MetaForwarder

### Constructor

```solidity
constructor()
```

### State-Changing Functions

```solidity
function execute(ForwardRequest calldata req, bytes calldata signature) external payable returns (bool, bytes memory)
function executeBatch(ForwardRequest[] calldata req, bytes[] calldata signature) external payable returns (bool[] memory, bytes[] memory)
function getNonce(address from) public view returns (uint256)
function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool)
```

### Pure Functions

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32)
```

## ProjectRegistry

### Constructor

```solidity
constructor(address _urbanCore, address _tokenAddress, address _trustedForwarder) ERC2771Context(_trustedForwarder) Pausable()
```

### State-Changing Functions

```solidity
function createProject(string calldata _title, string calldata _description, string calldata _ipfsHash, uint256 _fundingGoal, uint256 _deadline, bytes32 _areaId) external onlyRole(AccessRoles.PROJECT_ADMIN_ROLE) whenNotPaused returns (uint256)
function fundProject(uint256 _projectId, uint256 _amount) external whenNotPaused
function submitMilestone(uint256 _projectId, string calldata _title, string calldata _description, string calldata _ipfsHash) external whenNotPaused
function approveProjectCompletion(uint256 _projectId) external onlyRole(AccessRoles.PROJECT_ADMIN_ROLE) whenNotPaused
function completeProject(uint256 _projectId) external onlyRole(AccessRoles.PROJECT_ADMIN_ROLE) whenNotPaused
function cancelProject(uint256 _projectId) external onlyRole(AccessRoles.OWNER_ROLE) whenNotPaused
function upvoteProject(uint256 _projectId) external whenNotPaused
function setProjectTreasury(address _treasuryAddress) external onlyRole(AccessRoles.OWNER_ROLE)
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function updateUrbanCore(address _newUrbanCore) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTrustedForwarder(address _trustedForwarder) external onlyRole(AccessRoles.OWNER_ROLE)
```

### View Functions

```solidity
function getProject(uint256 _projectId) external view returns (Project memory)
function getProjects() external view returns (uint256[] memory)
function getProjectsByStatus(ProjectStatus _status) external view returns (uint256[] memory)
function getProjectsByArea(bytes32 _areaId) external view returns (uint256[] memory)
function getUpvotes(uint256 _projectId) external view returns (uint256)
function hasUpvoted(address _user, uint256 _projectId) external view returns (bool)
function getMilestones(uint256 _projectId) external view returns (Milestone[] memory)
function getMilestoneCount(uint256 _projectId) external view returns (uint256)
function getLatestMilestone(uint256 _projectId) external view returns (Milestone memory)
function isMsgSender(address _sender) internal view returns (address)
function _msgSender() internal view override(Context, ERC2771Context) returns (address)
function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata)
```

## TaxModule

### Constructor

```solidity
constructor(address _urbanCore, address _tokenAddress, address _taxReceiptAddress, address _trustedForwarder) ERC2771Context(_trustedForwarder) Pausable()
```

### State-Changing Functions

```solidity
function assessTax(address _citizen, uint256 _amount, string calldata _description, string calldata _ipfsHash) external onlyRole(AccessRoles.TAX_ADMIN_ROLE) whenNotPaused
function payTax(uint256 _taxId) external payable whenNotPaused
function metaPayTax(uint256 _taxId, bytes calldata _signature) external whenNotPaused
function fileObjection(uint256 _taxId, string calldata _reason) external whenNotPaused
function scheduleMeeting(uint256 _taxId, uint256 _timestamp, string calldata _meetingDetails) external onlyRole(AccessRoles.TAX_ADMIN_ROLE) whenNotPaused
function resolveTaxObjection(uint256 _taxId, bool _approved, uint256 _newAmount) external onlyRole(AccessRoles.TAX_ADMIN_ROLE) whenNotPaused
function setTaxTreasury(address _treasuryAddress) external onlyRole(AccessRoles.OWNER_ROLE)
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function updateUrbanCore(address _newUrbanCore) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTrustedForwarder(address _trustedForwarder) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTokenAddress(address _newTokenAddress) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTaxReceiptAddress(address _newTaxReceiptAddress) external onlyRole(AccessRoles.OWNER_ROLE)
```

### View Functions

```solidity
function getTax(uint256 _taxId) external view returns (Tax memory)
function getTaxesByUser(address _user) external view returns (uint256[] memory)
function getTaxCount() external view returns (uint256)
function getTaxesByStatus(TaxStatus _status) external view returns (uint256[] memory)
function getTaxesByArea(bytes32 _areaId) external view returns (uint256[] memory)
function getObjection(uint256 _taxId) external view returns (Objection memory)
function hasObjection(uint256 _taxId) external view returns (bool)
function isMsgSender(address _sender) internal view returns (address)
function _msgSender() internal view override(Context, ERC2771Context) returns (address)
function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata)
```

## TaxReceipt

### Constructor

```solidity
constructor(address _urbanCore, address _trustedForwarder) ERC2771Context(_trustedForwarder) ERC721("UrbanDAO Tax Receipt", "UDTR") Pausable()
```

### State-Changing Functions

```solidity
function mint(address _citizen, uint256 _taxId, uint256 _amount, string calldata _taxDescription, string calldata _ipfsHash) external onlyRole(AccessRoles.TAX_ADMIN_ROLE) whenNotPaused returns (uint256)
function updateTokenURI(uint256 _tokenId, string calldata _ipfsHash) external onlyRole(AccessRoles.TAX_ADMIN_ROLE)
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function updateUrbanCore(address _newUrbanCore) external onlyRole(AccessRoles.OWNER_ROLE)
function updateTrustedForwarder(address _trustedForwarder) external onlyRole(AccessRoles.OWNER_ROLE)
```

### View Functions

```solidity
function tokenURI(uint256 _tokenId) public view override returns (string memory)
function getReceipt(uint256 _tokenId) external view returns (TaxReceiptData memory)
function getReceiptsByOwner(address _owner) external view returns (uint256[] memory)
function getTotalReceiptsIssued() external view returns (uint256)
function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool)
function isMsgSender(address _sender) internal view returns (address)
function _msgSender() internal view override(Context, ERC2771Context) returns (address)
function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata)
function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override(ERC721) whenNotPaused
```

### Prevention Functions

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId) public override(ERC721)
function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override(ERC721)
function transferFrom(address from, address to, uint256 tokenId) public override(ERC721)
```

## UrbanCore

### Constructor

```solidity
constructor() initializer
```

### Initializer

```solidity
function initialize(address _owner, address _trustedForwarder) public initializer
```

### State-Changing Functions

```solidity
function registerCitizen(address _citizen, string calldata _name, string calldata _ipfsHash, bytes32 _areaId) external onlyRole(AccessRoles.ADMIN_ROLE) whenNotPaused
function approveCitizen(address _citizen) external onlyRole(AccessRoles.ADMIN_ROLE) whenNotPaused
function assignRole(address _account, bytes32 _role) external whenNotPaused
function revokeRole(address _account, bytes32 _role) external whenNotPaused
function assignAreaHead(address _areaHead, bytes32 _areaId) external onlyRole(AccessRoles.ADMIN_ROLE) whenNotPaused
function revokeAreaHead(address _areaHead, bytes32 _areaId) external onlyRole(AccessRoles.ADMIN_ROLE) whenNotPaused
function updateTrustedForwarder(address _trustedForwarder) external onlyRole(AccessRoles.OWNER_ROLE)
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function authorizeUpgrade(address) external onlyRole(AccessRoles.UPGRADER_ROLE)
```

### View Functions

```solidity
function getCitizen(address _citizen) external view returns (Citizen memory)
function isCitizen(address _account) external view returns (bool)
function isApprovedCitizen(address _account) external view returns (bool)
function getCitizensByArea(bytes32 _areaId) external view returns (address[] memory)
function getCitizenCount() external view returns (uint256)
function getAreaHead(bytes32 _areaId) external view returns (address)
function getAreaList() external view returns (bytes32[] memory)
function isAreaRegistered(bytes32 _areaId) external view returns (bool)
function getTrustedForwarder() external view returns (address)
function isTrustedForwarder(address _forwarder) external view returns (bool)
function isMsgSender(address _sender) internal view returns (address)
function _msgSender() internal view override(Context, ERC2771Context) returns (address)
function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata)
function _authorizeUpgrade(address) internal override onlyRole(AccessRoles.UPGRADER_ROLE)
```

## UrbanGovernor

### Constructor

```solidity
constructor(IVotes _token, TimelockController _timelock, string memory _name)
```

### State-Changing Functions

```solidity
function updateVotingPowerCap(uint256 newCap) external onlyRole(AccessRoles.OWNER_ROLE)
function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) public override(Governor, IGovernor) returns (uint256)
```

### View Functions

```solidity
function state(uint256 proposalId) public view virtual override(Governor, GovernorTimelockControl) returns (ProposalState)
function getVotes(address account, uint256 timepoint) public view override(Governor, IGovernor) returns (uint256)
function _getVotes(address account, uint256 timepoint, bytes memory params) internal view override(Governor, GovernorVotes) returns (uint256)
function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256)
function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256)
function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256)
function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256)
function supportsInterface(bytes4 interfaceId) public view override(Governor, AccessControl, GovernorTimelockControl) returns (bool)
function getEffectiveVotingPower(address account) external view returns (uint256)
function getRawVotingPower(address account) external view returns (uint256)
function isVotingPowerCapped(address account) external view returns (bool)
```

### Internal Functions

```solidity
function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal virtual override(Governor, GovernorTimelockControl) returns (uint256)
function _executor() internal view override(Governor, GovernorTimelockControl) returns (address)
function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal override(Governor, GovernorTimelockControl)
```

## UrbanTimelockController

### Constructor

```solidity
constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin) TimelockController(minDelay, proposers, executors, admin)
```

### State-Changing Functions

```solidity
function emergencyPause() external
```

## UrbanToken

### Constructor

```solidity
constructor(address owner, string memory name, string memory symbol, string memory imageURI, string memory description)
```

### State-Changing Functions

```solidity
function mintOnboard(address to, uint256 amount) external onlyRole(AccessRoles.OWNER_ROLE)
function mint(address to, uint256 amount) external onlyRole(AccessRoles.OWNER_ROLE)
function burn(address from, uint256 amount) external
function pause() external onlyRole(AccessRoles.OWNER_ROLE)
function unpause() external onlyRole(AccessRoles.OWNER_ROLE)
function transferOwnership(address newOwner) external onlyRole(AccessRoles.OWNER_ROLE)
function setTokenImageURI(string memory imageURI) external onlyRole(AccessRoles.OWNER_ROLE)
function setTokenDescription(string memory description) external onlyRole(AccessRoles.OWNER_ROLE)
```

### View Functions

```solidity
function nonces(address owner) public view override(ERC20Permit) returns (uint256)
function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool)
function availableSupply() external view returns (uint256)
function hasClaimedOnboardingReward(address citizen) external view returns (bool)
function tokenImageURI() external view returns (string memory)
function tokenDescription() external view returns (string memory)
function tokenMetadata() external view returns (string memory)
```

### Internal Functions

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal whenNotPaused override(ERC20)
function _mint(address account, uint256 amount) internal override(ERC20, ERC20Votes, ERC20Capped)
function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes)
function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes)
```
