const OrionVoting = artifacts.require("OrionVoting");

module.exports = async callback => {
    try {
        let voting = await OrionVoting.deployed();

        //  Set 28000 ORN per 1 week
        //

        await voting.setRewards('2800000000000', (86400 * 7).toString());

        let rewardRate = await voting.reward_rate_();

        console.log(rewardRate.toString());

    } catch (e) {
        callback(e);
    }
    callback()
};
