// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./libs/IWETH9.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract ElvateChest is Ownable {
    using SafeERC20 for IERC20;

    /// address of wrapped token
    address public immutable wrappedContractAddress;

    /// mapping of deposit by owner address and token address
    mapping(address => mapping(address => uint256)) public depositByOwnerByToken;

    /// event for deposit
    event TokenDeposited(address indexed _owner, address indexed _token, uint256 _amount);

    /// event for withdrawal
    event TokenWithdrawal(address indexed _owner, address indexed _token, uint256 _amount);

    /// @dev constructor
    /// @param _wrappedContractAddress address of wrapped token
    constructor(address _wrappedContractAddress) {
        wrappedContractAddress = _wrappedContractAddress;
    }

    /// @dev deposit token to the contract
    /// @param _token address of token to deposit
    /// @param _amount amount of token to deposit
    function depositToken(address _token, uint256 _amount) external {
        depositByOwnerByToken[msg.sender][_token] += _amount;
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        emit TokenDeposited(msg.sender, _token, _amount);
    }

    /// @dev withdraw token from the contract
    /// @param _token address of token to withdraw
    /// @param _amount amount of token to withdraw
    function withdrawToken(address _token, uint256 _amount) external {
        require(depositByOwnerByToken[msg.sender][_token] >= _amount, "Not enought deposit");
        depositByOwnerByToken[msg.sender][_token] -= _amount;
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit TokenWithdrawal(msg.sender, _token, _amount);
    }

    /// @dev deposit token and automatically wrap them
    function deposit() external payable {
        IWETH9(wrappedContractAddress).deposit{value: msg.value}();
        depositByOwnerByToken[msg.sender][wrappedContractAddress] += msg.value;
        emit TokenDeposited(msg.sender, wrappedContractAddress, msg.value);
    }

    /// @dev withdraw all specific token fees
    /// @param _token address of token to withdraw
    function withdrawTokenFees(address _token) external onlyOwner {
        uint256 dep = depositByOwnerByToken[address(this)][_token];
        require(dep > 0, "Nothing to withdraw");
        depositByOwnerByToken[address(this)][_token] -= dep;
        IERC20(_token).safeTransfer(msg.sender, dep);
    }

    /// @dev withdraw all pair creation fees
    function withdrawFees() external onlyOwner {
        require(address(this).balance > 0, "Nothing to withdraw");
        payable(msg.sender).transfer(address(this).balance);
    }
}
