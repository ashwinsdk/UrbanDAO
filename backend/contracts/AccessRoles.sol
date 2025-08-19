// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AccessRoles
 * @notice Library containing role constants and collision prevention logic for UrbanDAO
 * @dev Enforces unique role assignments to prevent privilege escalation
 */
library AccessRoles {
    // Role constants
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant ADMIN_GOVT_ROLE = keccak256("ADMIN_GOVT_ROLE");
    bytes32 public constant ADMIN_HEAD_ROLE = keccak256("ADMIN_HEAD_ROLE");
    bytes32 public constant PROJECT_MANAGER_ROLE = keccak256("PROJECT_MANAGER_ROLE");
    bytes32 public constant TAX_COLLECTOR_ROLE = keccak256("TAX_COLLECTOR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant CITIZEN_ROLE = keccak256("CITIZEN_ROLE");
    bytes32 public constant TX_PAYER_ROLE = keccak256("TX_PAYER_ROLE");

    // Custom errors
    error RoleCollision(address who, bytes32 existing, bytes32 requested);
    error InvalidRole(bytes32 role);
    error UnauthorizedRoleAssignment(address assigner, bytes32 role);

    /**
     * @notice Check if a role is privileged (non-citizen)
     * @param role The role to check
     * @return True if the role is privileged
     */
    function isPrivilegedRole(bytes32 role) internal pure returns (bool) {
        return role != CITIZEN_ROLE && role != bytes32(0);
    }

    /**
     * @notice Check if two roles would create a collision
     * @param existingRole The role already assigned to an address
     * @param newRole The role being requested
     * @return True if there would be a collision
     */
    function wouldCollide(bytes32 existingRole, bytes32 newRole) internal pure returns (bool) {
        // Citizens can coexist with any role
        if (existingRole == CITIZEN_ROLE || newRole == CITIZEN_ROLE) {
            return false;
        }
        
        // No existing role means no collision
        if (existingRole == bytes32(0)) {
            return false;
        }
        
        // Same role is not a collision (role update)
        if (existingRole == newRole) {
            return false;
        }
        
        // Two different privileged roles would collide
        return isPrivilegedRole(existingRole) && isPrivilegedRole(newRole);
    }

    /**
     * @notice Get the admin role for a given role
     * @param role The role to get the admin for
     * @return The admin role
     */
    function getRoleAdmin(bytes32 role) internal pure returns (bytes32) {
        if (role == OWNER_ROLE) return OWNER_ROLE; // Owner is self-administered
        if (role == ADMIN_GOVT_ROLE) return OWNER_ROLE;
        if (role == ADMIN_HEAD_ROLE) return ADMIN_GOVT_ROLE;
        if (role == VALIDATOR_ROLE) return ADMIN_HEAD_ROLE;
        if (role == TAX_COLLECTOR_ROLE) return ADMIN_HEAD_ROLE;
        if (role == PROJECT_MANAGER_ROLE) return ADMIN_HEAD_ROLE;
        if (role == CITIZEN_ROLE) return VALIDATOR_ROLE;
        if (role == TX_PAYER_ROLE) return OWNER_ROLE;
        
        revert InvalidRole(role);
    }

    /**
     * @notice Check if an address is authorized to assign a role
     * @param assigner The address attempting to assign the role
     * @param roleToAssign The role being assigned
     * @param hasRole Function to check if an address has a specific role
     * @return True if authorized
     */
    function isAuthorizedToAssign(
        address assigner,
        bytes32 roleToAssign,
        function(bytes32, address) external view returns (bool) hasRole
    ) internal view returns (bool) {
        bytes32 adminRole = getRoleAdmin(roleToAssign);
        return hasRole(adminRole, assigner);
    }

    /**
     * @notice Get all role constants as an array
     * @return Array of all role constants
     */
    function getAllRoles() internal pure returns (bytes32[] memory) {
        bytes32[] memory roles = new bytes32[](8);
        roles[0] = OWNER_ROLE;
        roles[1] = ADMIN_GOVT_ROLE;
        roles[2] = ADMIN_HEAD_ROLE;
        roles[3] = PROJECT_MANAGER_ROLE;
        roles[4] = TAX_COLLECTOR_ROLE;
        roles[5] = VALIDATOR_ROLE;
        roles[6] = CITIZEN_ROLE;
        roles[7] = TX_PAYER_ROLE;
        return roles;
    }
}
