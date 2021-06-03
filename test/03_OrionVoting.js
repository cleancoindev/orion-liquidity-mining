const { accounts, contract, web3, provider } = require('@openzeppelin/test-environment');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const chai = require('chai');

require("chai")
  .use(require("chai-shallow-deep-equal"))
  .use(require("chai-as-promised"))
  .should();


const ChainManipulation = require("./helpers/ChainManipulation");

async function ShiftTime(add_seconds)
{
    await ChainManipulation.advanceTime(add_seconds);
    await ChainManipulation.advanceBlock();
}

const OrionGovernance = contract.fromArtifact('OrionGovernance');
const OrionVoting = contract.fromArtifact('OrionVoting');
const TestToken = contract.fromArtifact('TestERC20');

const _30Days = 24*3600*30;
async function timeIncreaseTo (seconds) {
    const delay = 10 - new Date().getMilliseconds();
    await new Promise(resolve => setTimeout(resolve, delay));
    await time.increaseTo(seconds);
}

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
    const _1e18 = new BN('10').pow(new BN('18'));
    const expected = expectedOrig.div(_1e18);
    const actual = actualOrig.div(_1e18);
    this.assert(
        expected.eq(actual) ||
        expected.addn(1).eq(actual) || expected.addn(2).eq(actual) ||
        actual.addn(1).eq(expected) || actual.addn(2).eq(expected),
        'expected #{act} to be almost equal #{exp}',
        'expected #{act} to be different from #{exp}',
        expectedOrig.toString(),
        actualOrig.toString(),
    );
};

function ToORNWei(orn_val)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN('8')));
    return answ.toString();
}

function IsBnEqual(a, b, digits)
{
    return (a.sub(b)).abs().lt(new BN('10').pow(new BN(digits)));
}

function BNPow(a, digits)
{
    let answ = new BN(a);
    answ = answ.mul(new BN('10').pow(new BN(digits)));
    return answ;
}

//  Fuck this shit
function BNDiv(bn, digits)
{
    return bn.div(new BN('10').pow(new BN(digits)));
}

require('chai').use(function (chai, utils) {
    chai.Assertion.overwriteMethod('almostEqualDiv1e18', function (original) {
        return function (value) {
            if (utils.flag(this, 'bignumber')) {
                var expected = new BN(value);
                var actual = new BN(this._obj);
                almostEqualDiv1e18.apply(this, [expected, actual]);
            } else {
                original.apply(this, arguments);
            }
        };
    });
});


describe('OrionVoting', async function () {
    const [ owner, wallet1, wallet2, wallet3, wallet4 ] = accounts;

    beforeEach(async function () {
        this.orionToken = await TestToken.new(0, { from: owner });
        this.lpToken = await TestToken.new(0, { from: owner });

        this.orionGovernance = await OrionGovernance.new({ from: owner });
        this.orionGovernance.initialize(this.orionToken.address, { from: owner });

        this.orionVoting = await OrionVoting.new({ from: owner });
        this.orionVoting.initialize(this.orionToken.address, this.orionGovernance.address, { from: owner });

        this.poolAddress = '0x144d71cD8d331C3eB55B8d4e2119474dbb10729A';
        this.poolAddress2 = '0x2d23c313feac4810d9d014f840741363fccba675';
        //  this.poolAddress = 'fail fail';

        //  this.orionVoting = await OrionVoting.new(this.orionGovernance.address);
        await this.orionGovernance.setVotingContractAddress(this.orionVoting.address, {from: owner});
        //await this.orionVoting.setGovernanceContract(this.orionGovernance.address, {from: wallet1})

        await this.orionToken.mint(wallet1, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet2, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet3, ToORNWei('100'), {from: owner});
        await this.orionToken.mint(wallet4, ToORNWei('100'), {from: owner});

        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet1 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet2 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet3 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet4 });

        //  Let the random address will be pool address
        await this.orionVoting.setPoolState(this.poolAddress, 1+2+4, {from: owner});
        await this.orionVoting.setPoolState(this.poolAddress2, 1+2+4, {from: owner});
    });
/*
    it("Only owner can change owner", async function () {

        await this.orionVoting.transferOwnership(wallet2, {from: wallet2}).should.not.be.fulfilled;

        await this.orionVoting.transferOwnership(wallet2, {from: owner}).should.be.fulfilled;
        await this.orionVoting.transferOwnership(wallet1, {from: wallet2}).should.be.fulfilled;
    });
*/
    it("User can stake and vote (base)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
    });

    it("User can stake and vote (base-2)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        //  Can't stake +26
        await this.orionVoting.vote(this.poolAddress2, ToORNWei('26'), { from: wallet2 }).should.not.be.fulfilled;

        //  Can stake +24
        await this.orionVoting.vote(this.poolAddress, ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;
    });

    it("User can stake, vote and cease (base)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        //  Can't cease -28
        await this.orionVoting.cease(this.poolAddress, ToORNWei('28'), { from: wallet2 }).should.not.be.fulfilled;

        //  Can cease 25
        await this.orionVoting.cease(this.poolAddress, ToORNWei('25'), { from: wallet2 }).should.be.fulfilled;

        //  Can cease 1
        await this.orionVoting.cease(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
    });

    it("User can stake, vote, cease, unstake (base)", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        //  Can't unstake 26
        await this.orionGovernance.withdraw(ToORNWei('26'), { from: wallet2 }).should.not.be.fulfilled;

        //  Can unstake 24
        await this.orionGovernance.withdraw(ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;

        //  Can't vote anymore - EVEN WITH 1 wei (everything is locked in current vote)
        await this.orionVoting.vote(this.poolAddress, '1', { from: wallet2 }).should.not.be.fulfilled;

        //  Cease 2
        await this.orionVoting.cease(this.poolAddress, ToORNWei('2'), { from: wallet2 }).should.be.fulfilled;

        //  Can stake 1 for different pool
        await this.orionVoting.vote(this.poolAddress2, ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;

        //  Can't unstake 2
        await this.orionGovernance.withdraw(ToORNWei('2'), { from: wallet2 }).should.not.be.fulfilled;

        //  But can unstake 1
        await this.orionGovernance.withdraw(ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
    });

    it("User can vote but not cease (state=2)", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.setPoolState(this.poolAddress, 1, {from: owner});
        await this.orionVoting.vote(this.poolAddress, ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.cease(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.not.be.fulfilled;
    });

    it("User can vote, cease but not vote again (after vote change state=1)", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.setPoolState(this.poolAddress, 2, {from: owner});
        await this.orionVoting.cease(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.vote(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.not.be.fulfilled;
    });

    //  Tests with staking params
    it("Base pool rewards test", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('100'), { from: wallet2 });
        await this.orionVoting.setRewards(ToORNWei('100'), '100000', { from: owner }).should.be.fulfilled;

        expect(await this.orionVoting.reward_rate_())
          .to.be.bignumber.equal(new BN(100000));

        await this.orionVoting.vote(this.poolAddress, ToORNWei('12'), { from: wallet2 }).should.be.fulfilled;

        await time.increase(1000);
        reward = await this.orionVoting.getPoolRewards(this.poolAddress);
        expect(IsBnEqual(reward, BNPow(1, 26), 24)).to.be.true;

        await this.orionVoting.vote(this.poolAddress, ToORNWei('12'), { from: wallet2 }).should.be.fulfilled;
        await time.increase(1000);
        reward = await this.orionVoting.getPoolRewards(this.poolAddress);
        expect(IsBnEqual(reward, BNPow(2, 26), 24)).to.be.true;

        await this.orionVoting.cease(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
        await time.increase(500);
        await this.orionVoting.cease(this.poolAddress, ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
        await time.increase(500);

        reward = await this.orionVoting.getPoolRewards(this.poolAddress);
        expect(IsBnEqual(reward, BNPow(3, 26), 24)).to.be.true;
    });

    it("Base pool rewards test (2 pools)", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('100'), { from: wallet2 });
        await this.orionVoting.vote(this.poolAddress, ToORNWei('25'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.vote(this.poolAddress2, ToORNWei('75'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.setRewards(ToORNWei('100'), '100000', { from: owner }).should.be.fulfilled;

        //  Get the rewards for pool1
        await time.increase(1000);
        let pool1Rewards = await this.orionVoting.getPoolRewards(this.poolAddress);
        let pool2Rewards = await this.orionVoting.getPoolRewards(this.poolAddress2);

        //  BNPow(25, 24) is 0.25 * 10^26
        expect(IsBnEqual(pool1Rewards, BNPow(25, 24), 24)).to.be.true;
        expect(IsBnEqual(pool2Rewards, BNPow(75, 24), 24)).to.be.true;

        //  If pool 1 exits - then 2nd will get everything
        await this.orionVoting.cease(this.poolAddress, ToORNWei('25'), { from: wallet2 }).should.be.fulfilled;
        await ShiftTime(1000);

        pool1Rewards = await this.orionVoting.getPoolRewards(this.poolAddress);
        pool2Rewards = await this.orionVoting.getPoolRewards(this.poolAddress2);

        //  Expect the pool2 will get 1 ORN
        expect(IsBnEqual(pool1Rewards, BNPow(25, 24), 24)).to.be.true;
        expect(IsBnEqual(pool2Rewards, BNPow(175, 24), 24)).to.be.true;
    });

    it("1 pool stands, 2 manipulates", async function () {
        //  Stakes
        await this.orionGovernance.stake(ToORNWei('100'), { from: wallet2 });
        await this.orionGovernance.stake(ToORNWei('100'), { from: wallet3 });
        await this.orionVoting.setRewards(ToORNWei('100'), '100000', { from: owner }).should.be.fulfilled;

        //  Wallet2 votes and stands
        await this.orionVoting.vote(this.poolAddress, ToORNWei ('13'), { from: wallet2 }).should.be.fulfilled;

        await time.increase(1000);

        //  Wallet3 votes for anothder pool for 1000 seconds
        await this.orionVoting.vote(this.poolAddress2, ToORNWei('13'), { from: wallet3 }).should.be.fulfilled;
        await time.increase(1000);
        //  And exits
        await this.orionVoting.cease(this.poolAddress2, ToORNWei('13'), { from: wallet3 }).should.be.fulfilled;

        //  Get the rewards for pool1
        await time.increase(1000);
        pool1Rewards = await this.orionVoting.getPoolRewards(this.poolAddress);


        //  Answer should be 2.5.
        //      Because pool1 will get:
        //       - 1 ORN at first 1000 seconds
        //       - 0.5 ORN at second
        //       - 1 ORN at 3rd
        //  BNPow(25, 25) is 2.5 * 10^26
        expect(IsBnEqual(pool1Rewards, BNPow(25, 25), 24)).to.be.true;
    });

    it("2 users, one cannot cease more than voted", async function () {
        await this.orionGovernance.stake(ToORNWei('100'), { from: wallet2 });
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet3 });

        //  Vote from both users 50/50 of their amounts
        await this.orionVoting.vote(this.poolAddress, ToORNWei ('50'), { from: wallet2 }).should.be.fulfilled;
        await this.orionVoting.vote(this.poolAddress2, ToORNWei ('50'), { from: wallet2 }).should.be.fulfilled;

        await this.orionVoting.vote(this.poolAddress, ToORNWei ('25'), { from: wallet3 }).should.be.fulfilled;
        //  BTW check
        await this.orionVoting.vote(this.poolAddress2, ToORNWei ('33'), { from: wallet3 }).should.not.be.fulfilled;
        await this.orionVoting.vote(this.poolAddress2, ToORNWei ('25'), { from: wallet3 }).should.be.fulfilled;

        //  Trying to cease from pool1 more than voted
        await this.orionVoting.cease(this.poolAddress, ToORNWei ('26'), { from: wallet3 }).should.not.be.fulfilled;
        await this.orionVoting.cease(this.poolAddress, ToORNWei ('25'), { from: wallet3 }).should.be.fulfilled;

    });

});
