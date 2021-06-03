const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const OrionGovernance = artifacts.require("OrionGovernance");
const OrionVoting = artifacts.require("OrionVoting");
const OrionStakingReward = artifacts.require("OrionStakingReward");

//const OrionToken = artifacts.require("TestERC20");
//const LPToken = artifacts.require("LPToken");

module.exports = async (deployer, network, accounts) => {

  if (network === "bsc_testnet") {
    //  Example: npx truffle migrate --f 4 --to 4 --network bsc_testnet --compile-none

    //  Upgrade governance at proxy address
    const governance_proxy_address = "0x28aaaB9420010a756115c987509A57C40A6180f4";

    let governanceInstance = await upgradeProxy(
        governance_proxy_address,
        OrionGovernance,
        {unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true}
    );

    const governance = await OrionGovernance.deployed()
    console.log("Governance address = ", governance.address);
  }
};
