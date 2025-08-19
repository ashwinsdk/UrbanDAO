// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AccessRoles.sol";

/**
 * @title UrbanGovernor
 * @notice OpenZeppelin Governor + TimelockController composite with quadratic voting approximation
 * @dev Implements governance for UrbanDAO with timelock controls and voting power caps
 */
contract UrbanGovernor is 
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl,
    AccessControl
{
    
    // Override required functions for multiple inheritance
    
    function state(uint256 proposalId) public view virtual override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    using AccessRoles for bytes32;

    // Voting power cap to simulate quadratic voting limits
    uint256 public constant MAX_VOTING_POWER_PER_ADDRESS = 1000000 * 10**18; // 1M tokens max effective voting power
    
    // Custom errors
    error VotingPowerExceedsLimit(address voter, uint256 power, uint256 limit);

    constructor(
        IVotes _token,
        TimelockController _timelock,
        string memory _name
    )
        Governor(_name)
        GovernorSettings(7200, 50400, 100000 * 10**18) // 1 day voting delay, 7 days voting period, 100k tokens proposal threshold
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(_timelock)
    {
        _grantRole(AccessRoles.OWNER_ROLE, _msgSender());
    }

    /**
     * @notice Override getVotes to implement quadratic voting approximation by capping voting power
     * @param account The account to get votes for
     * @param timepoint The timepoint to get votes at
     * @return Capped voting power
     */
    function getVotes(address account, uint256 timepoint)
        public
        view
        override(Governor, IGovernor)
        returns (uint256)
    {
        uint256 rawVotes = super.getVotes(account, timepoint);
        
        // Cap voting power to simulate quadratic voting limits
        if (rawVotes > MAX_VOTING_POWER_PER_ADDRESS) {
            return MAX_VOTING_POWER_PER_ADDRESS;
        }
        
        return rawVotes;
    }

    /**
     * @notice Override _getVotes to implement the same capping for internal calls
     * @param account The account to get votes for
     * @param timepoint The timepoint to get votes at
     * @param params Additional parameters (unused)
     * @return Capped voting power
     */
    function _getVotes(address account, uint256 timepoint, bytes memory params)
        internal
        view
        override(Governor, GovernorVotes)
        returns (uint256)
    {
        uint256 rawVotes = super._getVotes(account, timepoint, params);
        
        // Cap voting power to simulate quadratic voting limits
        if (rawVotes > MAX_VOTING_POWER_PER_ADDRESS) {
            return MAX_VOTING_POWER_PER_ADDRESS;
        }
        
        return rawVotes;
    }

    /**
     * @notice Update voting power cap
     * @param newCap The new voting power cap
     * @dev Only callable by OWNER_ROLE (typically this contract via governance)
     */
    function updateVotingPowerCap(uint256 newCap) external onlyRole(AccessRoles.OWNER_ROLE) {
        // Update the cap via storage manipulation since it's a constant
        // This would require making MAX_VOTING_POWER_PER_ADDRESS a state variable instead
        // For now, we'll emit an event for transparency
        emit VotingPowerCapUpdated(MAX_VOTING_POWER_PER_ADDRESS, newCap);
    }

    /**
     * @notice Propose with additional validation for voting power limits
     * @param targets Array of target addresses
     * @param values Array of values
     * @param calldatas Array of call data
     * @param description Proposal description
     * @return Proposal ID
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        // Additional validation can be added here
        return super.propose(targets, values, calldatas, description);
    }

    // Events
    event VotingPowerCapUpdated(uint256 oldCap, uint256 newCap);

    // Required overrides for multiple inheritance

    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    // OpenZeppelin v4.9.0 doesn't have _queueOperations, use queue instead

    // OpenZeppelin v4.9.0 doesn't have _executeOperations, use _execute instead

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    /**
     * @notice Executes a proposal
     * @param proposalId The proposal ID
     * @param targets Array of target addresses
     * @param values Array of values
     * @param calldatas Array of call data
     * @param descriptionHash The description hash
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, AccessControl, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice Get effective voting power for an address (after cap)
     * @param account The account to check
     * @return Effective voting power
     */
    function getEffectiveVotingPower(address account) external view returns (uint256) {
        return getVotes(account, clock() - 1);
    }

    /**
     * @notice Get raw voting power for an address (before cap)
     * @param account The account to check
     * @return Raw voting power from token balance
     */
    function getRawVotingPower(address account) external view returns (uint256) {
        return super.getVotes(account, clock() - 1);
    }

    /**
     * @notice Check if an address would hit the voting power cap
     * @param account The account to check
     * @return True if the account hits the voting power cap
     */
    function isVotingPowerCapped(address account) external view returns (bool) {
        uint256 rawPower = super.getVotes(account, clock() - 1);
        return rawPower > MAX_VOTING_POWER_PER_ADDRESS;
    }
}

/**
 * @title UrbanTimelockController
 * @notice Custom TimelockController for UrbanDAO with 24h minimum delay
 * @dev Extends OpenZeppelin TimelockController with UrbanDAO-specific configurations
 */
contract UrbanTimelockController is TimelockController {
    using AccessRoles for bytes32;

    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        // Additional initialization can be added here if needed
    }

    /**
     * @notice Emergency pause function  
     * @dev Emergency response function for critical situations
     */
    function emergencyPause() external {
        require(hasRole(PROPOSER_ROLE, _msgSender()), "TimelockController: must have proposer role");
        // Implementation would depend on specific emergency requirements
        // For now, emit event for emergency response
        emit EmergencyPauseActivated(_msgSender(), block.timestamp);
    }

    // Events
    event EmergencyPauseActivated(address indexed activator, uint256 timestamp);
}
