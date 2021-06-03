// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "../interfaces/IOrionGovernance.sol";

contract OrionGovernance_TestHelper {
    IOrionGovernance private gov_;

    constructor(address gov) public
    {
        gov_ = IOrionGovernance(gov);
    }

    function acceptLock(uint56 amount) public
    {
        gov_.acceptLock(msg.sender, amount);
    }

    function acceptUnlock(uint56 amount) public
    {
        gov_.acceptUnlock(msg.sender, amount);
    }

    function acceptNewLockAmount(uint56 amount) public
    {
        gov_.acceptNewLockAmount(msg.sender, amount);
    }
}
