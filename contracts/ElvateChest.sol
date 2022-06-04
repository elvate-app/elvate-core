// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./libs/IWETH9.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract ElvateChest {
    using SafeERC20 for IERC20;

    address public wrappedContractAddress;

    mapping(address => mapping(address => uint256))
        public depositByOwnerByToken;

    event TokenDeposited(
        address indexed _owner,
        address indexed _token,
        uint256 _amount
    );

    event TokenWithdrawal(
        address indexed _owner,
        address indexed _token,
        uint256 _amount
    );

    function depositToken(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        depositByOwnerByToken[msg.sender][_token] += _amount;
        emit TokenDeposited(msg.sender, _token, _amount);
    }

    function withdrawToken(address _token, uint256 _amount) external {
        IERC20(_token).safeTransfer(msg.sender, _amount);
        depositByOwnerByToken[msg.sender][_token] -= _amount;
        emit TokenWithdrawal(msg.sender, _token, _amount);
    }

    function getDepositedToken(address _owner, address _token)
        public
        view
        returns (uint256)
    {
        return depositByOwnerByToken[_owner][_token];
    }

    function deposit() external payable {
        IWETH9(wrappedContractAddress).deposit{value: msg.value}();
        depositByOwnerByToken[msg.sender][wrappedContractAddress] += msg.value;
        emit TokenDeposited(msg.sender, wrappedContractAddress, msg.value);
    }
}
