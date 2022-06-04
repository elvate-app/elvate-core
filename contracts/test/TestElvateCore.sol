// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "../ElvateCore.sol";

/// @author aussedatlo
/// @title manager of pair/subscription trigger
contract TestElvateCore is ElvateCore {
    function getPath(address _tokenIn, address _tokenOut)
        public
        view
        returns (address[] memory)
    {
        return _getPath(_tokenIn, _tokenOut);
    }

    function distributeSwap(
        address _tokenIn,
        address _tokenOut,
        uint256[] memory _eligibleSubscriptions,
        uint256 eligibleSubscriptionsLength,
        uint256 _totalAmountIn,
        uint256 _totalAmountOut
    ) external {
        _distributeSwap(
            _tokenIn,
            _tokenOut,
            _eligibleSubscriptions,
            eligibleSubscriptionsLength,
            _totalAmountIn,
            _totalAmountOut
        );
    }

    function deductFees(uint256 _totalAmountOut, address _tokenOut)
        external
        returns (uint256)
    {
        return _deductFees(_totalAmountOut, _tokenOut);
    }
}
