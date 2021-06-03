const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');

const OrionGovernance = artifacts.require("OrionGovernance");
const OrionVoting = artifacts.require("OrionVoting");
const OrionStakingReward = artifacts.require("OrionStakingReward");

//const OrionToken = artifacts.require("TestERC20");
//const LPToken = artifacts.require("LPToken");

module.exports = async (deployer, network, accounts) => {
  if (network === "development") {

    //await deployer.deploy(OrionToken,0);
    //await deployer.deploy(LPToken,0);
  }

  if (network === "bsc_testnet") {
    //  Example: npx truffle migrate --network bsc_testnet --compile-none
    //  Example: npx truffle migrate --f 2 --to 2 --network bsc_testnet --compile-none

    //  Take look at
    const ORN = "0xf223eca06261145b3287a0fefd8cfad371c7eb34";

    //  NB: this is the just FIRST pair address.
    //    If you want to create another OrionStakingReward - please enter another
    //    address there
    const LPToken = "0x5dbBe35B5B11267d0336dfC06947A219985F5039";

    //   Deploy EVERYTHING with NEW proxy addresses (no upgrade available at this stage)
    //  const governance = await deployProxy(OrionGovernance, [ORN], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    //  console.log("Governance address = ", governance.address);
    const governance = await OrionGovernance.deployed()
    console.log("Governance address = ", governance.address);

    //  const voting = await deployProxy(OrionVoting, [ORN, governance.address], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    const voting = await OrionVoting.deployed();
    console.log("Voting address = ", voting.address);

    //  const orionStakingReward = await deployProxy(OrionStakingReward, [LPToken, voting.address], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    //  console.log("OrionStakingReward address = ", orionStakingReward.address);
    const orionStakingReward = await OrionStakingReward.deployed();
    console.log("StakingRewards address = ", orionStakingReward.address);

    //  Setup everything
    await governance.setVotingContractAddress(voting.address);
    await voting.setPoolState(orionStakingReward.address, 1+2+4);

    console.log("Done = ", orionStakingReward.address);
  }


  if (network === "ropsten") {
    const ORN = "0xfc25454ac2db9f6ab36bc0b0b034b41061c00982";

    //  NB: this is the just FIRST pair address.
    //    If you want to create another OrioNStakingReward - please enter another
    //    address there
    const LPToken = "0xe1bF4c9d567403c0A45E0Ee5EE0D9681814E9B54";

    //   Deploy EVERYTHING with NEW proxy addresses (no upgrade available at this stage)
    //  const governance = await deployProxy(OrionGovernance, [ORN], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    //  console.log("Governance address = ", governance.address);
    const governance = await OrionGovernance.deployed()
    console.log("Governance address = ", governance.address);

    //  const voting = await deployProxy(OrionVoting, [ORN, governance.address], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    const voting = await OrionVoting.deployed();
    console.log("Voting address = ", voting.address);

    //  const orionStakingReward = await deployProxy(OrionStakingReward, [LPToken, voting.address], {deployer, unsafeAllowCustomTypes: true, unsafeAllowLinkedLibraries: true});
    //  console.log("OrionStakingReward address = ", orionStakingReward.address);
    const orionStakingReward = await OrionStakingReward.deployed();
    console.log("StakingRewards address = ", orionStakingReward.address);

    //  Setup everything
    await governance.setVotingContractAddress(voting.address);
    await voting.setPoolState(orionStakingReward.address, 1+2+4);

    console.log("Done = ", orionStakingReward.address);

  }

  if (network === "live") {
   const ORN = "0x0258F474786DdFd37ABCE6df6BBb1Dd5dfC4434a";
   const LPToken = "0x6c8b0dee9e90ea9f790da5daf6f5b20d23b39689";
   //const stakingRewards = await deployProxy(StakingRewardsWithLongTermBonus, [accounts[0], ORN, LPToken], { deployer });
  }
};
