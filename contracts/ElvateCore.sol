// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./ElvateSubscription.sol";
import "./ElvatePair.sol";
import "./ElvateChest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/// @author aussedatlo
/// @title manager of pair/subscription trigger
contract ElvateCore is Ownable, ElvateChest {
    address public routerContractAddress;
    address public pairContractAddress;
    address public subscriptionContractAddress;
    uint128 public precision = 10**15;
    uint256 public frequency = 60 * 6; // * 24;

    mapping(address => mapping(address => uint256)) public depositByUserByToken;

    event PairTriggered(
        uint256 indexed pairId,
        uint256 lastPaidAt,
        uint256 totalSubscriptions,
        uint256 totalAmountIn,
        uint256 totalAmountOut,
        uint256 fees
    );

    function updateContractAddresses(
        address _routerContractAddress,
        address _pairContractAddress,
        address _subscriptionContractAddress,
        address _wrappedContractAddress
    ) external onlyOwner {
        routerContractAddress = _routerContractAddress;
        pairContractAddress = _pairContractAddress;
        subscriptionContractAddress = _subscriptionContractAddress;
        wrappedContractAddress = _wrappedContractAddress;
    }

    function trigger(address _tokenIn, address _tokenOut) external {
        ElvatePair(pairContractAddress).trigger(_tokenIn, _tokenOut);

        getEligibleSubscription(_tokenIn, _tokenOut);
    }

    function getEligibleSubscription(address _tokenIn, address _tokenOut)
        public
        view
        returns (uint256[] memory)
    {
        uint256 pairId = ElvatePair(pairContractAddress).pairIdByTokenInOut(
            _tokenIn,
            _tokenOut
        );
        ElvateSubscription.Subscription[]
            memory allSubscriptions = ElvateSubscription(
                subscriptionContractAddress
            ).getAllSubscriptions();
        uint256[] memory eligibleSubscriptions = new uint256[](
            allSubscriptions.length
        );

        for (uint256 index = 0; index < allSubscriptions.length; index++) {
            // TODO: check deposit
            // if (allSubscriptions[index].pairId == pairId) {
            //     eligibleSubscriptions.push(index);
            // }
        }

        return eligibleSubscriptions;
    }
}
