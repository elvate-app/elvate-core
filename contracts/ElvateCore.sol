// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./ElvatePair.sol";
import "./ElvateChest.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/// @author aussedatlo
/// @title manager of pair/subscription trigger
contract ElvateCore is ElvateChest, ElvatePair {
    using SafeERC20 for IERC20;

    address public immutable routerContractAddress;
    uint128 public immutable precision = 10**15;
    uint16 public swapFees = 5;
    uint24 public constant poolFee = 3000;

    event PairTriggered(
        uint256 indexed pairId,
        uint256 lastPaidAt,
        uint256 totalSubscriptions,
        uint256 totalAmountIn,
        uint256 totalAmountOut,
        uint256 fees
    );

    /// @dev constructor
    /// @param _routerContractAddress uniswap router contract address
    /// @param _wrappedContractAddress wrapped token contract address
    constructor(address _routerContractAddress, address _wrappedContractAddress) ElvateChest(_wrappedContractAddress) {
        routerContractAddress = _routerContractAddress;
    }

    /// @dev update fees
    /// @param _swapFees fees applied during swap
    /// @param _pairCreationFees fees applied during pair creation
    function updateFees(uint16 _swapFees, uint128 _pairCreationFees) external onlyOwner {
        swapFees = _swapFees;
        pairCreationFees = _pairCreationFees;
    }

    /// @dev trigger a pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function triggerPair(address _tokenIn, address _tokenOut) external {
        Sub[] memory eligibleSubs;
        uint256 swapResult;
        uint256 totalAmountIn;
        _trigger(_tokenIn, _tokenOut);

        (eligibleSubs, totalAmountIn) = getEligibleSubs(_tokenIn, _tokenOut);

        require(eligibleSubs.length > 0, "No eligible subscriptions");
        require(IERC20(_tokenIn).approve(routerContractAddress, totalAmountIn), "Approve failed");
        require(totalAmountIn > 0, "Nothing to buy");

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: _getPath(_tokenIn, _tokenOut),
            recipient: address(this),
            deadline: block.timestamp + 200,
            amountIn: totalAmountIn,
            amountOutMinimum: 0
        });

        swapResult = ISwapRouter(routerContractAddress).exactInput(params);

        uint256 totalAmountOut = _deductFees(swapResult, _tokenOut);

        _distributeSwap(_tokenIn, _tokenOut, eligibleSubs, totalAmountIn, totalAmountOut);

        emit PairTriggered(
            pairIdByTokenInOut[_tokenIn][_tokenOut],
            block.timestamp,
            eligibleSubs.length,
            totalAmountIn,
            totalAmountOut,
            swapFees
        );
    }

    /// @dev get list of all eligible subscriptions for a pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    /// @return list of eligible subs and total amount in
    function getEligibleSubs(address _tokenIn, address _tokenOut)
        public
        view
        onlyExistingPair(_tokenIn, _tokenOut)
        returns (Sub[] memory, uint256)
    {
        uint256 pairId = pairIdByTokenInOut[_tokenIn][_tokenOut];
        Pair memory pair = allPairs[pairId - 1];
        uint256 totalAmountIn;
        uint256 count;

        for (uint256 index; index < pair.subs.length; index++) {
            address owner = pair.subs[index];
            if (depositByOwnerByToken[owner][pair.tokenIn] >= subAmountInByOwnerPairId[owner][pairId]) {
                count++;
            }
        }

        Sub[] memory eligibleSubs = new Sub[](count);
        count = 0;

        for (uint256 index; index < pair.subs.length; index++) {
            address owner = pair.subs[index];
            uint256 amountIn = subAmountInByOwnerPairId[owner][pairId];
            if (depositByOwnerByToken[owner][pair.tokenIn] >= amountIn) {
                eligibleSubs[count] = Sub(amountIn, owner);
                totalAmountIn += amountIn;
                count++;
            }
        }

        return (eligibleSubs, totalAmountIn);
    }

    /// @dev deduct fees and distribute them to contract and sender
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output
    /// @return sequence of token address and pool fees handled by uniswap
    function _getPath(address _tokenIn, address _tokenOut) internal view returns (bytes memory) {
        if (_tokenIn != wrappedContractAddress && _tokenOut != wrappedContractAddress) {
            return abi.encodePacked(_tokenIn, poolFee, wrappedContractAddress, poolFee, _tokenOut);
        }

        return abi.encodePacked(_tokenIn, poolFee, _tokenOut);
    }

    /// @dev substract tokenIn based on subscription
    ///      and add tokenOut based on subscription weight
    /// @param _tokenIn address of tokenIn
    /// @param _tokenOut address of tokenOut
    /// @param _eligibleSubs list of all eligible subscriptions
    /// @param _totalAmountIn sum of all amountIn of all eligible subscription
    /// @param _totalAmountOut amount of tokenOut obtained via swap
    function _distributeSwap(
        address _tokenIn,
        address _tokenOut,
        Sub[] memory _eligibleSubs,
        uint256 _totalAmountIn,
        uint256 _totalAmountOut
    ) internal {
        uint256 totalAmountOutDistributed;

        for (uint256 index; index < _eligibleSubs.length; index++) {
            address owner = _eligibleSubs[index].owner;
            uint256 amountIn = _eligibleSubs[index].amountIn;
            depositByOwnerByToken[owner][_tokenIn] -= amountIn;

            // weight of sub
            uint256 weight = (amountIn * precision) / _totalAmountIn;

            // add amountOut to user based on weight of sub
            uint256 amountOut = (_totalAmountOut * weight) / precision;

            depositByOwnerByToken[owner][_tokenOut] += amountOut;

            // keep track of all amountOut
            totalAmountOutDistributed += amountOut;
        }

        // keep the small pieces
        require(_totalAmountOut >= totalAmountOutDistributed, "Invalid distribution");
        depositByOwnerByToken[address(this)][_tokenOut] += _totalAmountOut - totalAmountOutDistributed;
    }

    /// @dev deduct fees and distribute them to contract and sender
    /// @param _totalAmountOut total amount of token purchased
    /// @param _tokenOut address of token out
    /// @return Total amount out after fees
    function _deductFees(uint256 _totalAmountOut, address _tokenOut) internal returns (uint256) {
        uint256 fees = (_totalAmountOut * swapFees) / 10000;

        // Take one part for contract
        depositByOwnerByToken[address(this)][_tokenOut] += fees;

        // and other part for sender
        depositByOwnerByToken[address(msg.sender)][_tokenOut] += fees;

        return _totalAmountOut - fees * 2;
    }
}
