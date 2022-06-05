// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./ElvatePair.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @author aussedatlo
/// @title manager of Pair Subscriptions
contract ElvateSubscription is Ownable {
    /// subscription structure
    struct Subscription {
        uint256 amountIn;
        uint256 pairId;
        address owner;
    }

    event SubscriptionCreated(Subscription subscription);
    event SubscriptionEdited(Subscription subscription);

    /// array of all subscriptions
    Subscription[] public allSubscriptions;
    /// subscriptions id token in and token out
    mapping(address => mapping(address => mapping(address => uint256)))
        public subscriptionIdByOwnerTokenInTokenOut;
    /// elvate pair contract address
    address public pairContractAddress;

    /// @dev subscribe to a pair
    /// @param _tokenIn address of tokenIn
    /// @param _tokenOut address of tokenOut
    /// @param _amountIn amount to put on each buy
    /// @notice available only if pair exist
    function subscribe(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external {
        uint256 pairId = _getElvatePairId(_tokenIn, _tokenOut);
        require(pairId > 0, "Invalid pair");

        if (
            subscriptionIdByOwnerTokenInTokenOut[msg.sender][_tokenIn][
                _tokenOut
            ] > 0
        ) {
            // subscription already exist
            allSubscriptions[
                subscriptionIdByOwnerTokenInTokenOut[msg.sender][_tokenIn][
                    _tokenOut
                ] - 1
            ].amountIn = _amountIn;

            emit SubscriptionEdited(
                allSubscriptions[
                    subscriptionIdByOwnerTokenInTokenOut[msg.sender][_tokenIn][
                        _tokenOut
                    ] - 1
                ]
            );
        } else {
            // subscription does not exist
            allSubscriptions.push(Subscription(_amountIn, pairId, msg.sender));
            subscriptionIdByOwnerTokenInTokenOut[msg.sender][_tokenIn][
                _tokenOut
            ] = allSubscriptions.length;

            emit SubscriptionCreated(
                allSubscriptions[allSubscriptions.length - 1]
            );
        }
    }

    /// @dev get all subscriptions
    /// @return array of all subscriptions
    function getAllSubscriptions() public view returns (Subscription[] memory) {
        return allSubscriptions;
    }

    /// @dev update ElvatePair contract address
    /// @param _pairContractAddress new ElvatePair contract address
    function updateAddress(address _pairContractAddress) external onlyOwner {
        pairContractAddress = _pairContractAddress;
    }

    /// @dev get ElvatePair id
    /// @param _tokenIn address of tokenIn
    /// @param _tokenOut address of tokenOut
    function _getElvatePairId(address _tokenIn, address _tokenOut)
        internal
        view
        returns (uint256)
    {
        return
            ElvatePair(pairContractAddress).pairIdByTokenInOut(
                _tokenIn,
                _tokenOut
            );
    }
}
