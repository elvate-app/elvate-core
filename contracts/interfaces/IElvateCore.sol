// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

/// @author aussedatlo
interface IElvateCore {
    struct Sub {
        uint256 amountIn;
        address owner;
    }

    struct Pair {
        uint256 id;
        uint256 lastPaidAt;
        address tokenIn;
        address tokenOut;
        address[] subs;
    }

    function allPairs(uint256)
        external
        view
        returns (
            uint256 id,
            uint256 lastPaidAt,
            address tokenIn,
            address tokenOut
        );

    function createPair(address _tokenIn, address _tokenOut) external;

    function deposit() external;

    function depositByOwnerByToken(address, address) external view returns (uint256);

    function depositToken(address _token, uint256 _amount) external;

    function frequency() external view returns (uint16);

    function getEligibleSubs(address _tokenIn, address _tokenOut) external view returns (Sub[] memory, uint256);

    function getPairs() external view returns (Pair[] memory);

    function getSubs(address _tokenIn, address _tokenOut) external view returns (Sub[] memory);

    function owner() external view returns (address);

    function pairCreationFees() external view returns (uint128);

    function pairIdByTokenInOut(address, address) external view returns (uint256);

    function poolFee() external view returns (uint24);

    function precision() external view returns (uint128);

    function renounceOwnership() external;

    function routerContractAddress() external view returns (address);

    function subAmountInByOwnerPairId(address, uint256) external view returns (uint256);

    function subscribe(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external;

    function swapFees() external view returns (uint16);

    function transferOwnership(address newOwner) external;

    function triggerPair(address _tokenIn, address _tokenOut) external;

    function unsubscribe(address _tokenIn, address _tokenOut) external;

    function updateFees(uint16 _swapFees, uint128 _pairCreationFees) external;

    function withdrawFees() external;

    function withdrawToken(address _token, uint256 _amount) external;

    function withdrawTokenFees(address _token) external;

    function wrappedContractAddress() external view returns (address);
}
