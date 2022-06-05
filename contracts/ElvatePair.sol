// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @author aussedatlo
/// @title Elvate Pair
contract ElvatePair is Ownable {
    /// pair struct
    struct Pair {
        uint256 id;
        uint256 lastPaidAt;
        address tokenIn;
        address tokenOut;
    }

    /// array of all pairs
    Pair[] public allPairs;
    /// pair creation fees
    uint128 public fees = 0.1 ether;
    /// frequency
    uint16 public frequency = 60 * 6;
    /// pair manager
    address public coreContractAddress;
    /// pair by tokenIn tokenOut
    mapping(address => mapping(address => uint256)) public pairIdByTokenInOut;

    // Event triggered when a pair is created
    event PairCreated(uint256 _id, address _tokenIn, address _tokenOut);
    // Event triggered when a pair is triggered
    event PairTriggered(uint256 indexed pairId, uint256 lastPaidAt);

    /// @dev verify if pair doesn't exist
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    modifier onlyNonExistingPair(address _tokenIn, address _tokenOut) {
        // pair with id of 0 is not initialized
        require(
            pairIdByTokenInOut[_tokenIn][_tokenOut] == 0,
            "Pair already exist"
        );
        _;
    }

    /// @dev verify if pair exist
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    modifier onlyExistingPair(address _tokenIn, address _tokenOut) {
        require(pairIdByTokenInOut[_tokenIn][_tokenOut] > 0, "No pair found");
        _;
    }

    /// @dev verify if tokenIn is diffent to tokenOut
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    modifier onlyDifferentTokens(address _tokenIn, address _tokenOut) {
        require(_tokenIn != _tokenOut, "Tokens cannot be identical");
        _;
    }

    /// @dev create pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function createPair(address _tokenIn, address _tokenOut)
        external
        payable
        onlyNonExistingPair(_tokenIn, _tokenOut)
        onlyDifferentTokens(_tokenIn, _tokenOut)
        returns (uint256)
    {
        if (msg.sender != owner()) {
            require(msg.value >= fees, "Insufficient fees");
        }

        uint256 pairId = allPairs.length + 1;
        allPairs.push(Pair(pairId, 1, _tokenIn, _tokenOut));
        pairIdByTokenInOut[_tokenIn][_tokenOut] = pairId;
        emit PairCreated(pairId, _tokenIn, _tokenOut);
        return pairId;
    }

    /// @dev get all pairs
    /// @return array of all pairs
    function getAllPairs() public view returns (Pair[] memory) {
        return allPairs;
    }

    /// @dev update pair creation fee
    /// @param _fees value of fees to update
    function updateFees(uint128 _fees) external onlyOwner {
        fees = _fees;
    }

    /// @dev update manager address
    /// @param _coreContractAddress value of fees to update
    function updateAddress(address _coreContractAddress) external onlyOwner {
        coreContractAddress = _coreContractAddress;
    }

    /// @dev update lastPaidAt of specific pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function trigger(address _tokenIn, address _tokenOut)
        external
        onlyExistingPair(_tokenIn, _tokenOut)
    {
        require(
            allPairs[pairIdByTokenInOut[_tokenIn][_tokenOut] - 1].lastPaidAt +
                frequency <
                block.timestamp,
            "Unable to trigger right now"
        );
        require(msg.sender == coreContractAddress, "Caller is not the manager");

        allPairs[pairIdByTokenInOut[_tokenIn][_tokenOut] - 1].lastPaidAt = block
            .timestamp;

        emit PairTriggered(
            pairIdByTokenInOut[_tokenIn][_tokenOut],
            allPairs[pairIdByTokenInOut[_tokenIn][_tokenOut] - 1].lastPaidAt
        );
    }
}
