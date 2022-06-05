// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./libs/IWETH9.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract ElvateChest {
    using SafeERC20 for IERC20;

    /// address of wrapped token
    address public wrappedContractAddress;

    /// mapping of deposit by owner address and token address
    mapping(address => mapping(address => uint256))
        public depositByOwnerByToken;

    /// event for deposit
    event TokenDeposited(
        address indexed _owner,
        address indexed _token,
        uint256 _amount
    );

    /// event for withdrawal
    event TokenWithdrawal(
        address indexed _owner,
        address indexed _token,
        uint256 _amount
    );

    /// @dev deposit token to the contract
    /// @param _token address of token to deposit
    /// @param _amount amount of token to deposit
    function depositToken(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        depositByOwnerByToken[msg.sender][_token] += _amount;
        emit TokenDeposited(msg.sender, _token, _amount);
    }

    /// @dev withdraw token to the contract
    /// @param _token address of token to withdraw
    /// @param _amount amount of token to withdraw
    function withdrawToken(address _token, uint256 _amount) external {
        IERC20(_token).safeTransfer(msg.sender, _amount);
        depositByOwnerByToken[msg.sender][_token] -= _amount;
        emit TokenWithdrawal(msg.sender, _token, _amount);
    }

    /// @dev get token deposited to the platform for specific user
    /// @param _owner address of owner to check deposit
    /// @param _token address of token to check deposit
    function getDepositedToken(address _owner, address _token)
        public
        view
        returns (uint256)
    {
        return depositByOwnerByToken[_owner][_token];
    }

    /// @dev deposit token and automatically wrap them
    function deposit() external payable {
        IWETH9(wrappedContractAddress).deposit{value: msg.value}();
        depositByOwnerByToken[msg.sender][wrappedContractAddress] += msg.value;
        emit TokenDeposited(msg.sender, wrappedContractAddress, msg.value);
    }
}
