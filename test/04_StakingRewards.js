const { accounts, contract, web3, provider } = require('@openzeppelin/test-environment');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ChainManipulation = require("./helpers/ChainManipulation");
const chai = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();


chai.Assertion.addMethod('bnEquals', function (type) {
    //  var obj = this._obj;

    //  new chai.Assertion(this._obj).to.be.instanceof(BN); // OKk
    //  new chai.Assertion(typeof this._obj.toString()).to.be.a('string'); // OK

    var a = new BN(type);
    var b = new BN(this._obj);

    let zero = new BN('0');

    if(a.eq(zero) || b.eq(zero))
    {
        new chai.Assertion(a.eq(b)).eql(true, "'"+a.toString() + "' should be equal to '" + b.toString()+"'");
    }
    else
    {
        //  10^12 is enough
        //  Both are non-zero
        let ratio = a.mul(new BN ('1000000000000')).div(b);

        new chai.Assertion(
            ratio.gt(new BN('990000000000')) && ratio.lt(new BN('1010000000000'))
        ).eql(true, a.toString() + " should be almost equal to " + b.toString());
    }
});

const OrionGovernance = contract.fromArtifact('OrionGovernance');
const OrionVoting = contract.fromArtifact('OrionVoting');
const OrionStakingReward = contract.fromArtifact('OrionStakingReward');
const TestToken = contract.fromArtifact('TestERC20');
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"; // ETH "asset" address in balances

const _30Days = 24*3600*30;
async function timeIncreaseTo (seconds) {
    const delay = 10 - new Date().getMilliseconds();
    await new Promise(resolve => setTimeout(resolve, delay));
    await time.increaseTo(seconds);
}

function OrnBN(orn_val)
{
    let answ = new BN(orn_val);
    return answ.mul(new BN('10').pow(new BN('8')));
}

function ToORNWei(orn_val)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN('8')));
    return answ.toString();
}

function ToLPWei(orn_val)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN('18')));
    return answ.toString();
}

function BNPow(a, digits)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN(digits)));
    return answ;
}

function IsBnEqual(a, b, digits)
{
    return (a.sub(b)).abs().lt(new BN('10').pow(new BN(digits)));
}

async function MineNextBlock()
{
    await ChainManipulation.advanceTime(1);
    await ChainManipulation.advanceBlock();
}

async function ShiftTime(add_seconds)
{
    await ChainManipulation.advanceTime(add_seconds);
    await ChainManipulation.advanceBlock();
}

describe('OrionStakingRewards', async function () {
    const [ owner, wallet1, wallet2, wallet3, wallet4 ] = accounts;
    before(async function () {
        this.GovStake = async (amount, wallet=false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            if(amount > 0)
                return this.orionGovernance.stake(ToORNWei(amount), { from: target_wallet });
            else
                return this.orionGovernance.withdraw(ToORNWei(-amount), { from: target_wallet });
        }

        this.Vote = async (amount, wallet=false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            if(amount > 0)
                return this.orionVoting.vote(this.orionStakingRewards.address, ToORNWei(amount), { from: target_wallet });
            else
                return this.orionVoting.cease(this.orionStakingRewards.address, ToORNWei(-amount), { from: target_wallet });

        }

        this.VoteForEmpty = async (amount, wallet=false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            if(amount > 0)
                return this.orionVoting.vote(this.unusedPool.address, ToORNWei(amount), { from: target_wallet });
            else
                return this.orionVoting.cease(this.unusedPool.address, ToORNWei(-amount), { from: target_wallet });

        }

        this.RewardStake = async (amount, wallet=false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            if(amount > 0)
                return this.orionStakingRewards.stake(ToLPWei(amount), { from: target_wallet });
            else
                return this.orionStakingRewards.withdraw(ToLPWei(-amount), { from: target_wallet });
        }

        this.SetRewards = async (orn_amount, seconds) =>
        {
            await this.orionVoting.setRewards(ToORNWei(orn_amount), seconds, { from: owner }).should.be.fulfilled;
        }

        this.RewardExit = async(wallet = false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            await this.orionStakingRewards.exit({ from: target_wallet }).should.be.fulfilled;
        }

        this.MintOrn = async(amount, wallet) =>
        {
            await this.orionToken.mint(wallet, ToORNWei(amount), {from: owner});
        }

        this.BurnOrn = async(wallet = false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            let balance = (await this.orionToken.balanceOf(target_wallet)).toString();
            await this.orionToken.transfer('0xDc966DCB447004dF677c8A509dd24A070AE93Bf2', balance, {from: target_wallet}).should.be.fulfilled;
        }

        this.OrnBalance = async(wallet = false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            return await this.orionToken.balanceOf(target_wallet);
        }

        this.LpTokenBalance = async(wallet = false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            return await this.lpToken.balanceOf(target_wallet);
        }

        this.GetRewards = async(wallet = false) =>
        {
            const target_wallet = (wallet ? wallet : wallet2);
            return await this.orionStakingRewards.getReward({from: target_wallet}).should.be.fulfilled;
        }

    });

    beforeEach(async function () {
        this.orionToken = await TestToken.new(0, { from: owner });
        this.lpToken = await TestToken.new(0, { from: owner });

        this.orionGovernance = await OrionGovernance.new({ from: owner });
        this.orionGovernance.initialize(this.orionToken.address, { from: owner });

        this.orionVoting = await OrionVoting.new({ from: owner });
        this.orionVoting.initialize(this.orionToken.address, this.orionGovernance.address, { from: owner });

        this.orionStakingRewards = await OrionStakingReward.new({ from: owner });
        this.orionStakingRewards.initialize( this.lpToken.address, this.orionVoting.address, { from: owner });

        this.unusedPool = {address: '0x144d71cD8d331C3eB55B8d4e2119474dbb10729A'};

        //  Setup everything
        await this.orionGovernance.setVotingContractAddress(this.orionVoting.address, {from: owner});
        await this.orionVoting.setPoolState(this.orionStakingRewards.address, 1+2+4, {from: owner});

        //  Just setup unused pool, so we can distribute votes to it
        await this.orionVoting.setPoolState(this.unusedPool.address, 1+2+4, {from: owner});


        //await this.orionVoting.setGovernanceContract(this.orionGovernance.address, {from: wallet1})

        await this.orionToken.mint(wallet1, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet2, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet3, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet4, ToORNWei('100'), {from: owner});

        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet1 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet2 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet3 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet4 });

        await this.lpToken.mint(wallet1, ToLPWei('100'), {from: owner});
        await this.lpToken.mint(wallet2, ToLPWei('100'), {from: owner});
        await this.lpToken.mint(wallet3, ToLPWei('100'), {from: owner});
        await this.lpToken.mint(wallet4, ToLPWei('100'), {from: owner});

        await this.lpToken.approve(this.orionStakingRewards.address, new BN(2).pow(new BN(255)), { from: wallet1 });
        await this.lpToken.approve(this.orionStakingRewards.address, new BN(2).pow(new BN(255)), { from: wallet2 });
        await this.lpToken.approve(this.orionStakingRewards.address, new BN(2).pow(new BN(255)), { from: wallet3 });
        await this.lpToken.approve(this.orionStakingRewards.address, new BN(2).pow(new BN(255)), { from: wallet4 });
    });

    //  Access rights test
    it("Non-staker could not withdraw", async function () {
        await this.GovStake(50).should.be.fulfilled;
        await this.GovStake(-1, wallet3).should.not.be.fulfilled;
        //  expect(new BN('1000')).bnEquals(1020);
    });

    it("Non-owner could not do emergency withdrawal", async function () {
        await this.GovStake(50).should.be.fulfilled;
        await this.orionStakingRewards.emergencyAssetWithdrawal(this.lpToken.address, { from: wallet3 }).should.not.be.fulfilled;
    });

    it("Owner could do emergency withdrawal", async function () {
        await this.RewardStake(50).should.be.fulfilled;
        let prev_balance = await this.lpToken.balanceOf(owner);
        await this.orionStakingRewards.emergencyAssetWithdrawal(this.lpToken.address, { from: owner }).should.be.fulfilled;
        let after_balance = await this.lpToken.balanceOf(owner);
        (after_balance - prev_balance).toString().should.be.equal(ToLPWei('50'));
    });

    it("The most base test (just stake)", async function () {
        await this.GovStake(50);
        await this.Vote(26).should.be.fulfilled;

        await this.RewardStake(26).should.be.fulfilled;
        await this.RewardStake(75).should.not.be.fulfilled;
        await this.RewardStake(74).should.be.fulfilled;
    });

    it("Stake with no votes for pool gives 0", async function () {
        await this.GovStake(50);
        await this.MintOrn(10001, this.orionVoting.address);
        await this.SetRewards(100, 100000);

        await this.RewardStake(26);

        //  Shift time
        await ShiftTime(86400 * 7);

        //  BTW check that could now unstake more than staked
        await this.RewardStake(-27).should.not.be.fulfilled;
        //  But he can unstake the same amount
        await this.RewardStake(-26).should.be.fulfilled;
        await this.GetRewards().should.be.fulfilled;

        //  Balance should be equal to starting balance
        //  let orn_balance = (await this.orionToken.balanceOf(wallet2)).toString();
        (await this.OrnBalance()).toString().should.be.equal(ToORNWei('50'));
    });

    it("Stake with 1 single vote for pool gives 100%", async function () {
        //  Stake at givernance and vote for our pool
        await this.GovStake(50, wallet4);
        await this.Vote(50, wallet4);

            await this.MintOrn(101, this.orionVoting.address);
            await this.SetRewards(100, 100000);
            await this.BurnOrn();

        //  Stake something
        //      It does not make sence, how much, because it will get all
        await this.RewardStake(1);

        //  Wait 10000 secomds :)
        await ShiftTime(100000);

        await this.RewardExit().should.be.fulfilled;

        expect(await this.OrnBalance()).bnEquals(ToORNWei(100));
    });

    it("One staker, one vote, one exit", async function () {
        await this.GovStake(50);
        await this.Vote(50);

        await this.BurnOrn();

        await this.RewardStake(10);

            //  Set rewards and give money
            await this.MintOrn(101, this.orionVoting.address);
            await this.SetRewards(100, 100000);

        //  Shift time to the 60% of period
        await ShiftTime(70000);

        //  await this.RewardExit(wallet3);
        await this.RewardExit();
        //  Should get 70

        expect(await this.OrnBalance()).bnEquals(ToORNWei(70));
    });

    //
    it("Two stakers get rewards by their ratio", async function () {
        await this.GovStake(50);
        await this.Vote(50);

        await this.BurnOrn();
        await this.BurnOrn(wallet3);
        //let w2_balance = await this.OrnBalance();
        //let w3_balance = await this.OrnBalance(wallet3);

        //  Stake from wallet2 and wallet3
        //      Gives us 75$  and 25%
        await this.RewardStake(11, wallet3);
        await this.RewardStake(33);

        //  Set rewards and give money
        await this.MintOrn(100000000001, this.orionVoting.address);
        await this.SetRewards(100, 100000);

        //  Shift time to the 60% of period
        await ShiftTime(60000);


        //  Check earned
        //  let earned;
        //  earned = await this.orionStakingRewards.earned.call(wallet2, {from: wallet2});
        //  console.log("Wallet 2 earned after ShiftTime = ", earned.toString());
        //  earned = await this.orionStakingRewards.earned.call(wallet3, {from: wallet3});
        //  console.log("Wallet 3 earned after ShiftTime = ", earned.toString());

        await this.RewardExit(wallet3);
        await this.RewardExit();

        expect(await this.OrnBalance()).bnEquals(ToORNWei(45));
        expect(await this.OrnBalance(wallet3)).bnEquals(ToORNWei(15));
    });


    //  TODO: make test with parameters
    it("One staker gets rewards with changing single voice", async function () {
        await this.GovStake(50);
        await this.Vote(10);

        //  Set rewards and give money (not more than needed)
        await this.MintOrn(101, this.orionVoting.address);
        const duration = 100000;
        await this.SetRewards(100, duration);

        //  Clear ORN on wallet2 (for convenience)
        await this.BurnOrn();

        //  No matter how much 1 single staker will stake
        await this.RewardStake(1);
        //  Measure accumulators from voting before shift

        await ShiftTime(duration / 2);

        //  After this vote we have accumulator values in OrionStakingRewards untouched
        await this.Vote(5);

        await ShiftTime(duration / 2);

        //  await ShiftTime(duration / 2);
        //  await this.RewardStake(-1);
        await this.RewardExit();

        expect(await this.OrnBalance()).bnEquals(ToORNWei(100));
    });

    it("One staker gets rewards with changing single voice and his staking", async function () {
        await this.GovStake(50);
        await this.Vote(10);

        //  Set rewards and give money (not more than needed)
        await this.MintOrn(101, this.orionVoting.address);
        const duration = 100000;
        await this.SetRewards(100, duration);

        //  Clear ORN on wallet2 (for convenience)
        await this.BurnOrn();

        //  No matter how much 1 single staker will stake
        await this.RewardStake(1);
        //  Measure accumulators from voting before shift

        await ShiftTime(duration / 4);

        //  No matter how much 1 single staker will REstake
        await this.RewardStake(2);

        await ShiftTime(duration / 4);

        //  After this vote we have accumulator values in OrionStakingRewards untouched
        await this.Vote(5);

        await ShiftTime(duration / 2);

        //  await ShiftTime(duration / 2);
        //  await this.RewardStake(-1);
        await this.RewardExit();

        expect(await this.OrnBalance()).bnEquals(ToORNWei(100));
    });

    it("Vote, stake, cease half, get full rewards", async function () {
        await this.GovStake(50);
        await this.Vote(10);

        //  Set rewards and give money (not more than needed)
        await this.MintOrn(101, this.orionVoting.address);
        const duration = 100000;
        await this.SetRewards(100, duration);

        //  Clear ORN on wallet2 (for convenience)
        await this.BurnOrn();

        //  No matter how much 1 single staker will stake
        await this.RewardStake(1);

        //  After 1/2 time - cease half of voting
        //      It SHOULD NOT have effect, because only 1 voter in whole governance
        await ShiftTime(duration / 2);

        await this.Vote(-5);

        await ShiftTime(duration / 2);

        await this.RewardExit();

        expect(await this.OrnBalance()).bnEquals(ToORNWei(100));
    });

    it("Vote, stake, cease FULL, get HALF OF rewards", async function () {
        await this.GovStake(50);
        await this.Vote(10);

        //  Set rewards and give money (not more than needed)
        await this.MintOrn(101, this.orionVoting.address);
        const duration = 100000;
        await this.SetRewards(100, duration);

        //  Clear ORN on wallet2 (for convenience)
        await this.BurnOrn();

        //  No matter how much 1 single staker will stake
        await this.RewardStake(1);

        //  After 1/2 time - cease FULL voting
        await ShiftTime(duration / 2);

        await this.Vote(-10);

        await ShiftTime(duration / 2);

        await this.RewardExit();

        expect(await this.OrnBalance()).bnEquals(ToORNWei(50));

    });

    it("Changing votes for pools during staking", async function () {
        await this.GovStake(50);
        await this.Vote(10);

        //  Set rewards and give money (not more than needed)
        await this.MintOrn(101, this.orionVoting.address);
        const duration = 100000;
        await this.SetRewards(100, duration);

        //  Clear ORN on wallet2 (for convenience)
        await this.BurnOrn();
        await this.RewardStake(1);

        //  Wait 1/3 and vote for another pool
        await ShiftTime(33333);
        await this.VoteForEmpty(10);

        //  Wait 1/3 and cease from another pool
        await ShiftTime(33333);
        await this.VoteForEmpty(-10);

        //  Wait 1/3 and exit
        await ShiftTime(33334);

        await this.RewardExit();

        //  console.log("Balance after exit ", (await this.OrnBalance()).toString());

        //  We should get 33.3 + 33.3/2 + 33.3 ORN = 100 * 5.6 = ~83
        expect(await this.OrnBalance()).bnEquals('8333333333');
    });

    it("Two users vote and stake in different order (1)", async function () {
        //  Set rewards and give money (not more than needed, +1%)
        await this.MintOrn(28028, this.orionVoting.address);
        const duration = 86400 * 7;
        await this.SetRewards(28000, duration);

        //  From both wallets - give 50 ORN
        //      It does not matter, because we test there only voting
        await this.GovStake(50);
        await this.GovStake(50, wallet3);

        //  Burn remaining ORN
        await this.BurnOrn();
        await this.BurnOrn(wallet3);

        await this.Vote(10);
        //  Wait a bit of time
        await ShiftTime(duration / 10);
        await this.Vote(15, wallet3);
        //  And vote for empty pool
        await this.VoteForEmpty(35, wallet3);

        //  Wait a little bit more
        await ShiftTime(duration / 10);

        //////////////////////////////////////////
        //  So, we have 25 voted for target pool, and 35 for "empty"
        //      It means that for 4/10 of time - pool will get:
        //  28000 * (4/10) * (25/(25+35)) = 4666.66 ORN
        //      1/3 of 4666.66 will get wallet2, 2/3 - wallet3
        await this.RewardStake(1);
        await this.RewardStake(2, wallet3);

        await ShiftTime(duration / 10 * 4);

        //  Check earned() function
        let earned;
        earned = await this.orionStakingRewards.earned.call(wallet2, {from: wallet2});
        expect(earned).bnEquals(ToORNWei(1555));

        earned = await this.orionStakingRewards.earned.call(wallet3, {from: wallet2});
        expect(earned).bnEquals(ToORNWei(3111));

        //  Now let's unvote the unused pool
        await this.VoteForEmpty(-35).should.not.fulfilled;
        await this.VoteForEmpty(-35, wallet3).should.be.fulfilled;
        //      So, ALL rewards 28000*(4/10) will be sent to target pool
        //  So, both stakers will get
        await ShiftTime(duration / 10 * 4);

        earned = await this.orionStakingRewards.earned.call(wallet2, {from: wallet2});
        expect(earned).bnEquals(ToORNWei(1555 + 3733 + 1));

        earned = await this.orionStakingRewards.earned.call(wallet3, {from: wallet2});
        expect(earned).bnEquals(ToORNWei(3111 + 7466 + 1));

        //  Exit
        await this.RewardExit().should.be.fulfilled;
        await this.RewardExit(wallet3).should.be.fulfilled;

        //  Also check that was paid exactly as earned
        expect(await this.OrnBalance()).bnEquals(ToORNWei(1555 + 3733 + 1));
        expect(await this.OrnBalance(wallet3)).bnEquals(ToORNWei(3111 + 7466 + 1));

        //  And re-check earned (should be 0)

        earned = await this.orionStakingRewards.earned.call(wallet2, {from: wallet2});
        expect(earned).bnEquals(0);

        earned = await this.orionStakingRewards.earned.call(wallet3, {from: wallet3});
        expect(earned).bnEquals(0);
    });

    //

    /*  //  Weird test
    it("Base rewards test", async function () {
        //  Governance staking, voting, setting rewards in ORN
        //  Time problem?
        console.log('befpre = ', (await ChainManipulation.getBlockchainTime()).toString());

        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.orionStakingRewards.address, ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;

        //  Set 28k ORN per week
        //      One week contains 86400 * 7 = 604800 seconds
        await this.orionVoting.setRewards(ToORNWei('28000'), '604800', { from: wallet1 }).should.be.fulfilled;
        //  Mint enough tokens to pay rewards
        await this.orionToken.mint(this.orionVoting.address, ToORNWei('100000'));

        console.log('after = ', (await ChainManipulation.getBlockchainTime()).toString());

        //  Now let's stake some LP tokens...
        await this.orionStakingRewards.stake(ToLPWei('20'), { from: wallet2 }).should.be.fulfilled;
        await MineNextBlock();
        console.log("voting_acc_reward_ = ", (await this.orionStakingRewards.voting_acc_reward_()).toString());
        console.log("rewards_per_token_stored_ = ", (await this.orionStakingRewards.rewards_per_token_stored_()).toString());
        console.log("voting_acc_pool_supply_ = ", (await this.orionStakingRewards.voting_acc_pool_supply_()).toString());
        console.log("total_supply_ = ", (await this.orionStakingRewards.total_supply_()).toString());
        await this.orionStakingRewards.stake(ToLPWei('20'), { from: wallet2 }).should.be.fulfilled;
        await MineNextBlock();
        console.log("voting_acc_reward_ = ", (await this.orionStakingRewards.voting_acc_reward_()).toString());
        console.log("rewards_per_token_stored_ = ", (await this.orionStakingRewards.rewards_per_token_stored_()).toString());
        console.log("voting_acc_pool_supply_ = ", (await this.orionStakingRewards.voting_acc_pool_supply_()).toString());
        console.log("total_supply_ = ", (await this.orionStakingRewards.total_supply_()).toString());

        await this.orionStakingRewards.stake(ToLPWei('20'), { from: wallet2 }).should.be.fulfilled;
        await MineNextBlock();
        console.log("voting_acc_reward_ = ", (await this.orionStakingRewards.voting_acc_reward_()).toString());
        console.log("rewards_per_token_stored_ = ", (await this.orionStakingRewards.rewards_per_token_stored_()).toString());
        console.log("voting_acc_pool_supply_ = ", (await this.orionStakingRewards.voting_acc_pool_supply_()).toString());
        console.log("total_supply_ = ", (await this.orionStakingRewards.total_supply_()).toString());

        //  console.log((await this.orionStakingRewards.last_update_time_()).toString());
        //  Shift time by 1 week
        await ChainManipulation.advanceTime(86400 * 7);
        await ChainManipulation.advanceBlock();

        //  Getting back everything to wallet2
        await this.orionStakingRewards.exit({ from: wallet2 }).should.be.fulfilled;
        await MineNextBlock();
        console.log("voting_acc_reward_ = ", (await this.orionStakingRewards.voting_acc_reward_()).toString());
        console.log("rewards_per_token_stored_ = ", (await this.orionStakingRewards.rewards_per_token_stored_()).toString());
        console.log("voting_acc_pool_supply_ = ", (await this.orionStakingRewards.voting_acc_pool_supply_()).toString());
        console.log("total_supply_ = ", (await this.orionStakingRewards.total_supply_()).toString());
        console.log("After exit balance is ", (await this.orionToken.balanceOf(wallet2)).toString());

    });
     */
});
