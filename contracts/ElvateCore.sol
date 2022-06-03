// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./ElvateSubscription.sol";
import "./ElvatePair.sol";
import "./ElvateChest.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

/// @author aussedatlo
/// @title manager of pair/subscription trigger
contract ElvateCore is Ownable, ElvateChest {
    using SafeERC20 for IERC20;

    address public routerContractAddress;
    address public pairContractAddress;
    address public subscriptionContractAddress;
    uint128 public precision = 10**15;
    uint256 public frequency = 60 * 6; // * 24;
    uint16 public swapFee = 5;

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
        uint256[] memory eligibleSubscriptions;
        uint256 totalAmountIn;
        uint256 eligibleSubscriptionsLength;
        address[] memory path = _getPath(_tokenIn, _tokenOut);
        uint256[] memory swapResult;
        ElvatePair(pairContractAddress).trigger(_tokenIn, _tokenOut);
        (
            eligibleSubscriptions,
            totalAmountIn,
            eligibleSubscriptionsLength
        ) = getEligibleSubscription(_tokenIn, _tokenOut);

        require(eligibleSubscriptionsLength > 0, "No eligible subscriptions");
        require(
            IERC20(_tokenIn).approve(routerContractAddress, totalAmountIn),
            "approve failed"
        );
        uint256 allowance = IERC20(_tokenIn).allowance(
            address(this),
            routerContractAddress
        );
        require(allowance >= totalAmountIn, "Token allowance not sufficient");

        uint256[] memory amounts = IUniswapV2Router02(routerContractAddress)
            .getAmountsOut(totalAmountIn, path);

        swapResult = IUniswapV2Router02(routerContractAddress)
            .swapExactTokensForTokens(
                totalAmountIn,
                amounts[amounts.length - 1],
                path,
                address(this),
                block.timestamp + 10000
            );

        uint256 totalAmountOut = _deductFees(
            swapResult[swapResult.length - 1],
            _tokenOut
        );

        // distribute token to users
        _distributeSwap(
            _tokenIn,
            _tokenOut,
            eligibleSubscriptions,
            eligibleSubscriptionsLength,
            totalAmountIn,
            totalAmountOut
        );
    }

    function getEligibleSubscription(address _tokenIn, address _tokenOut)
        public
        view
        returns (
            uint256[] memory,
            uint256,
            uint256
        )
    {
        uint256 count = 0;
        uint256 totalAmountIn = 0;
        uint256 pairId = ElvatePair(pairContractAddress).pairIdByTokenInOut(
            _tokenIn,
            _tokenOut
        );

        ElvatePair.Pair[] memory allPairs = ElvatePair(pairContractAddress)
            .getAllPairs();

        ElvateSubscription.Subscription[]
            memory allSubscriptions = ElvateSubscription(
                subscriptionContractAddress
            ).getAllSubscriptions();

        uint256[] memory eligibleSubscriptions = new uint256[](
            allSubscriptions.length
        );

        for (uint256 index = 0; index < allSubscriptions.length; index++) {
            if (
                allSubscriptions[index].pairId == pairId &&
                getDepositedToken(
                    allSubscriptions[index].owner,
                    allPairs[pairId - 1].tokenIn
                ) >=
                allSubscriptions[index].amountIn
            ) {
                eligibleSubscriptions[count] = index;
                totalAmountIn += allSubscriptions[index].amountIn;
                count++;
            }
        }

        return (eligibleSubscriptions, totalAmountIn, count);
    }

    function _getPath(address _tokenIn, address _tokenOut)
        public
        view
        returns (address[] memory)
    {
        if (
            _tokenIn != wrappedContractAddress &&
            _tokenOut != wrappedContractAddress
        ) {
            address[] memory pathWithWBNB = new address[](3);
            pathWithWBNB[0] = _tokenIn;
            pathWithWBNB[1] = wrappedContractAddress;
            pathWithWBNB[2] = _tokenOut;
            return pathWithWBNB;
        }

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        return path;
    }

    /// @dev substract tokenIn based on subscription
    ///      and add tokenOut based on subscription weight
    /// @param _tokenIn address of tokenIn
    /// @param _tokenOut address of tokenOut
    /// @param _eligibleSubscriptions list of all eligible subscriptions
    /// @param _totalAmountIn sum of all amountIn of all eligible subscription
    /// @param _totalAmountOut amount of tokenOut obtained via swap
    function _distributeSwap(
        address _tokenIn,
        address _tokenOut,
        uint256[] memory _eligibleSubscriptions,
        uint256 eligibleSubscriptionsLength,
        uint256 _totalAmountIn,
        uint256 _totalAmountOut
    ) internal {
        uint256 totalAmountOutDistributed = 0;
        for (uint256 index = 0; index < eligibleSubscriptionsLength; index++) {
            (, uint256 amountIn, address owner) = ElvateSubscription(
                subscriptionContractAddress
            ).allSubscriptions(_eligibleSubscriptions[index]);
            // substract tokenIn from user deposit based on subscription
            depositByOwnerByToken[owner][_tokenIn] -= amountIn;

            // weight of subscription
            uint256 weight = (amountIn * precision) / _totalAmountIn;

            // add amountOut to user based on weight of subscription
            uint256 amountOut = (_totalAmountOut * weight) / precision;

            depositByOwnerByToken[owner][_tokenOut] += amountOut;

            // keep track of all amountOut
            totalAmountOutDistributed += amountOut;
        }

        // keep the small pieces
        depositByOwnerByToken[address(this)][_tokenOut] +=
            _totalAmountOut -
            totalAmountOutDistributed;
    }

    /// @dev deduct fees and distribute them to contract and sender
    /// @param _totalAmountOut total amount of token purchased
    /// @param _tokenOut address of token out
    /// @return Total aamount out after fees
    function _deductFees(uint256 _totalAmountOut, address _tokenOut)
        internal
        returns (uint256)
    {
        uint256 fees = (_totalAmountOut * swapFee) / 10000;

        // Take one part for contract
        depositByOwnerByToken[address(this)][_tokenOut] += fees;

        // and other part for sender
        IERC20(_tokenOut).safeTransfer(msg.sender, fees);

        return _totalAmountOut - fees * 2;
    }
}
