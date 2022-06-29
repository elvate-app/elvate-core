// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @author aussedatlo
/// @title Elvate Pair
abstract contract ElvatePair is Ownable {
    /// Sub struct
    struct Sub {
        uint256 amountIn;
        address owner;
    }

    /// pair struct
    struct Pair {
        uint256 id;
        uint256 lastPaidAt;
        address tokenIn;
        address tokenOut;
        address[] subs;
    }

    /// array of all pairs
    Pair[] public allPairs;
    /// pair creation fees
    uint128 public pairCreationFees = 0.1 ether;
    /// frequency
    uint16 public frequency = 60 * 6;
    /// pair by tokenIn tokenOut
    mapping(address => mapping(address => uint256)) public pairIdByTokenInOut;
    /// subscription id by pair id and owner address
    mapping(address => mapping(uint256 => uint256)) public subAmountInByOwnerPairId;

    // Event triggered when a pair is created
    event PairCreated(uint256 _id, address _tokenIn, address _tokenOut);
    // Event triggered when a subscription is created, edited or deleted
    event SubEdited(uint256 _pairId, address _owner, uint256 _amountIn);

    /// @dev verify if pair doesn't exist
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    modifier onlyNonExistingPair(address _tokenIn, address _tokenOut) {
        // pair with id of 0 is not initialized
        require(pairIdByTokenInOut[_tokenIn][_tokenOut] == 0, "Pair already exist");
        _;
    }

    /// @dev verify if pair exist
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    modifier onlyExistingPair(address _tokenIn, address _tokenOut) {
        require(pairIdByTokenInOut[_tokenIn][_tokenOut] > 0, "No pair found");
        _;
    }

    /// @dev create pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function createPair(address _tokenIn, address _tokenOut) external payable onlyNonExistingPair(_tokenIn, _tokenOut) {
        require(_tokenIn != _tokenOut, "Tokens cannot be identical");
        if (msg.sender != owner()) {
            require(msg.value >= pairCreationFees, "Insufficient fees");
        }

        uint256 pairId = allPairs.length + 1;
        allPairs.push(Pair(pairId, 1, _tokenIn, _tokenOut, new address[](0)));
        pairIdByTokenInOut[_tokenIn][_tokenOut] = pairId;
        emit PairCreated(pairId, _tokenIn, _tokenOut);
    }

    /// @dev subscribe to a pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    /// @param _amountIn amount to subscribe
    function subscribe(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external onlyExistingPair(_tokenIn, _tokenOut) {
        require(_amountIn > 0, "Can't subscribe with amount <= 0");
        uint256 pairId = pairIdByTokenInOut[_tokenIn][_tokenOut];

        if (subAmountInByOwnerPairId[msg.sender][pairId] == 0) {
            subAmountInByOwnerPairId[msg.sender][pairId] = _amountIn;
            allPairs[pairId - 1].subs.push(msg.sender);
        } else {
            subAmountInByOwnerPairId[msg.sender][pairId] = _amountIn;
        }

        emit SubEdited(pairId, msg.sender, _amountIn);
    }

    /// @dev delete subscription to a pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function unsubscribe(address _tokenIn, address _tokenOut) external onlyExistingPair(_tokenIn, _tokenOut) {
        uint256 pairId = pairIdByTokenInOut[_tokenIn][_tokenOut];
        Pair storage pair = allPairs[pairId - 1];

        require(subAmountInByOwnerPairId[msg.sender][pairId] != 0, "No subscription found");

        for (uint256 index; index < pair.subs.length; index++) {
            if (pair.subs[index] == msg.sender) {
                delete subAmountInByOwnerPairId[msg.sender][pairId];
                pair.subs[index] = pair.subs[pair.subs.length - 1];
                pair.subs.pop();
                break;
            }
        }

        emit SubEdited(pairId, msg.sender, 0);
    }

    /// @dev get all pairs
    /// @return array of all pairs
    function getPairs() public view returns (Pair[] memory) {
        return allPairs;
    }

    /// @dev get all subscriptions from specific pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    /// @return array of all subs of a pair
    function getPairSubs(address _tokenIn, address _tokenOut)
        public
        view
        onlyExistingPair(_tokenIn, _tokenOut)
        returns (Sub[] memory)
    {
        uint256 pairId = pairIdByTokenInOut[_tokenIn][_tokenOut];
        Sub[] memory subs = new Sub[](allPairs[pairId - 1].subs.length);
        for (uint256 index; index < subs.length; index++) {
            Sub memory sub = subs[index];
            sub.owner = allPairs[pairId - 1].subs[index];
            sub.amountIn = subAmountInByOwnerPairId[sub.owner][pairId];
        }

        return subs;
    }

    /// @dev update lastPaidAt of specific pair
    /// @param _tokenIn address of input token
    /// @param _tokenOut address of output token
    function _trigger(address _tokenIn, address _tokenOut) internal onlyExistingPair(_tokenIn, _tokenOut) {
        Pair storage pair = allPairs[pairIdByTokenInOut[_tokenIn][_tokenOut] - 1];
        require(pair.lastPaidAt + frequency < block.timestamp, "Unable to trigger right now");

        pair.lastPaidAt = block.timestamp;
    }
}
