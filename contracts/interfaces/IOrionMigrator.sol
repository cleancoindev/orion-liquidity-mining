// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

interface IOrionMigrator {
    function migrate(uint256 tokensToMigrate, uint amount0Min, uint amount1Min, address to, uint deadline) external;
}
