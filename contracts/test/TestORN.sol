// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';
import './Mintable.sol';

contract TestORN is Mintable {
    constructor(uint amount) ERC20('Test ERC20', 'TEST') ERC20Capped(100e6 * 10**8) public {
        _setupDecimals(8);
        mint(msg.sender, amount);
    }
}
