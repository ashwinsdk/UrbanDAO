// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MetaForwarder
 * @notice Minimal ERC-2771 trusted forwarder implementing EIP-712 domain for gasless transactions
 * @dev Handles signature verification and execution with replay protection
 */
contract MetaForwarder is EIP712 {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    // Domain separator for EIP-712
    bytes32 private constant TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    // Nonce mapping for replay protection
    mapping(address => uint256) private _nonces;

    // Events
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 indexed nonce,
        bool success,
        bytes returnData
    );

    // Custom errors
    error InvalidSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error ExecutionFailed(bytes returnData);

    constructor() EIP712("MetaForwarder", "1.0.0") {}

    /**
     * @notice Get the current nonce for an address
     * @param from The address to get the nonce for
     * @return The current nonce
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @notice Verify a forward request signature
     * @param req The forward request to verify
     * @param signature The signature to verify
     * @return True if the signature is valid
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @notice Execute a forward request
     * @param req The forward request to execute
     * @param signature The signature authorizing the request
     * @return success Whether the execution was successful
     * @return returnData The return data from the execution
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool success, bytes memory returnData)
    {
        // Verify signature and nonce
        if (!verify(req, signature)) {
            revert InvalidSignature();
        }

        // Check nonce to prevent replay attacks
        if (_nonces[req.from] != req.nonce) {
            revert InvalidNonce(_nonces[req.from], req.nonce);
        }

        // Increment nonce
        _nonces[req.from]++;

        // Execute the call with specified gas limit
        (success, returnData) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Emit event for tracking
        emit MetaTransactionExecuted(req.from, req.to, req.nonce, success, returnData);

        // Revert if execution failed (optional - can be removed for non-reverting behavior)
        if (!success) {
            // If there's return data, it's a revert reason
            if (returnData.length > 0) {
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert ExecutionFailed(returnData);
            }
        }

        return (success, returnData);
    }

    /**
     * @notice Batch execute multiple forward requests
     * @param reqs Array of forward requests to execute
     * @param signatures Array of signatures corresponding to each request
     * @return successes Array of success flags for each execution
     * @return returnDatas Array of return data for each execution
     */
    function executeBatch(ForwardRequest[] calldata reqs, bytes[] calldata signatures)
        external
        payable
        returns (bool[] memory successes, bytes[] memory returnDatas)
    {
        require(reqs.length == signatures.length, "Array length mismatch");
        
        successes = new bool[](reqs.length);
        returnDatas = new bytes[](reqs.length);

        for (uint256 i = 0; i < reqs.length; i++) {
            (successes[i], returnDatas[i]) = execute(reqs[i], signatures[i]);
        }

        return (successes, returnDatas);
    }

    /**
     * @notice Get the domain separator for this forwarder
     * @return The domain separator hash
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Check if this contract is a trusted forwarder for the given address
     * @dev This is used by ERC2771Context to verify the forwarder
     * @param forwarder The address to check
     * @return True if this contract address matches the forwarder
     */
    function isTrustedForwarder(address forwarder) external view returns (bool) {
        return forwarder == address(this);
    }
}
