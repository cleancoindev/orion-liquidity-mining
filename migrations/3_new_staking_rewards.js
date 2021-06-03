const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const OrionGovernance = artifacts.require("OrionGovernance");
const OrionVoting = artifacts.require("OrionVoting");
const OrionStakingReward = artifacts.require("OrionStakingReward");

//const OrionToken = artifacts.require("TestERC20");
//const LPToken = artifacts.require("LPToken");

module.exports = async (deployer, network, accounts) => {

  if (network === "bsc_testnet") {
    //  Example: npx truffle migrate --network bsc_testnet --compile-none
    //  Example: npx truffle migrate --f 3 --to 3 --network bsc_testnet --compile-none

    //    MUST BE AN already created OrionPoolPair address
    const LPToken = "0x50AaC4f19e2C841ff07ac203D54C962Be65FcA1A";


    const governance = await OrionGovernance.deployed()
    console.log("Governance address = ", governance.address);

    const voting = await OrionVoting.deployed();
    console.log("Voting address = ", voting.address);

    await deployProxy(OrionStakingReward, [LPToken, voting.address], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    const orionStakingReward = await OrionStakingReward.deployed();
    console.log("StakingRewards address = ", orionStakingReward.address);

    //  Setup everything
    await voting.setPoolState(orionStakingReward.address, 1+2+4);

    console.log("Done = ", orionStakingReward.address);
  }
};
