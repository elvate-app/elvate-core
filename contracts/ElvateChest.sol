// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./libs/IWETH9.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

abstract contract ElvateChest {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public wrappedContractAddress;

    mapping(address => mapping(address => uint256))
        public depositByOwnerByToken;

    event TokenDeposited(address indexed _owner, uint256 _amount);
    event TokenWithdrew(address indexed _owner, uint256 _amount);

    function depositToken(address _token, uint256 _amount) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        depositByOwnerByToken[_token][msg.sender] = SafeMath.add(
            depositByOwnerByToken[_token][msg.sender],
            _amount
        );
        emit TokenDeposited(msg.sender, _amount);
    }

    function withdrawToken(address _token, uint256 _amount) external {
        depositByOwnerByToken[_token][msg.sender] = SafeMath.sub(
            depositByOwnerByToken[_token][msg.sender],
            _amount
        );
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit TokenWithdrew(msg.sender, _amount);
    }

    function getDepositedToken(address _owner, address _token)
        public
        view
        returns (uint256)
    {
        return depositByOwnerByToken[_token][_owner];
    }

    function deposit() external payable {
        IWETH9(wrappedContractAddress).deposit{value: msg.value}();
        depositByOwnerByToken[wrappedContractAddress][msg.sender] = SafeMath
            .add(
                depositByOwnerByToken[wrappedContractAddress][msg.sender],
                msg.value
            );
        emit TokenDeposited(msg.sender, msg.value);
    }
}
