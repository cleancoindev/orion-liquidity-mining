const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const OrionGovernance = contract.fromArtifact('OrionGovernance');
const TestToken = contract.fromArtifact('TestERC20');
const OrionGovernance_TestHelper = contract.fromArtifact('OrionGovernance_TestHelper');

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

describe('OrionGovernance', async function () {
    const [ owner, wallet1, wallet2, wallet3, wallet4 ] = accounts;
    beforeEach(async function () {
        this.orionToken = await TestToken.new(0, { from: owner });
        this.orionGovernance = await OrionGovernance.new({ from: owner });
        await this.orionGovernance.initialize(this.orionToken.address, { from: owner });
        this.ogTestHelper = await OrionGovernance_TestHelper.new(this.orionGovernance.address, { from: owner });
        await this.orionGovernance.setVotingContractAddress(this.ogTestHelper.address, {from: owner});

        await this.orionToken.mint(wallet1, ToORNWei('100'), { from: owner });
        await this.orionToken.mint(wallet2, ToORNWei('100'), { from: owner });
        await this.orionToken.mint(wallet3, ToORNWei('100'), { from: owner });
        await this.orionToken.mint(wallet4, ToORNWei('100'), { from: owner });

        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet1 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet2 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet3 });
        await this.orionToken.approve(this.orionGovernance.address, new BN(2).pow(new BN(255)), { from: wallet4 });


        //  this.started = (await time.latest()).addn(10);
        //  await timeIncreaseTo(this.started);
    });

    it("Owner can change voting contract address", async function () {
        await this.orionGovernance.setVotingContractAddress(wallet1, {from: owner}).should.be.fulfilled;
    });

    it("Non-owner cannot change voting contract address", async function () {
        await this.orionGovernance.setVotingContractAddress(wallet2, {from: wallet2}).should.not.be.fulfilled;
    });

    it("Non-voting address cannot call accept*()", async function () {
        await this.orionGovernance.acceptNewLockAmount(wallet2, 1, {from: wallet3}).should.not.be.fulfilled;
        await this.orionGovernance.acceptLock(wallet2, 1, {from: wallet2}).should.not.be.fulfilled;
        await this.orionGovernance.acceptUnlock(wallet2, 1, {from: wallet2}).should.not.be.fulfilled;
    });

    it("Base stake checks", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
        (await this.orionGovernance.getBalance(wallet2)).toString().should.be.equal(ToORNWei('50'));
        (await this.orionGovernance.getBalance(wallet1)).toString().should.be.equal(ToORNWei('0'));
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('50'));
        console.log((await this.orionGovernance.getTotalBalance()).toString());
    });

    it("User can stake and unstake (not greater than staked)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });
        await this.orionGovernance.withdraw(ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;
        (await this.orionGovernance.getBalance(wallet2)).toString().should.be.equal(ToORNWei('26'));
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('26'));

        //  No way to withdraw more
        await this.orionGovernance.withdraw(ToORNWei('27'), { from: wallet2 }).should.not.be.fulfilled;

        await this.orionGovernance.withdraw(ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;
        (await this.orionGovernance.getBalance(wallet2)).toString().should.be.equal(ToORNWei('0'));
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('0'));
    });

    it("User can stake and vote (not greated than staked)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 });

        await this.ogTestHelper.acceptNewLockAmount(ToORNWei('51'), { from: wallet2 }).should.not.be.fulfilled;
        (await this.orionGovernance.getLockedBalance(wallet2)).toString().should.be.equal('0');

        await this.ogTestHelper.acceptNewLockAmount(ToORNWei('49'), { from: wallet2 }).should.be.fulfilled;
        await this.ogTestHelper.acceptNewLockAmount(ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
        (await this.orionGovernance.getLockedBalance(wallet2)).toString().should.be.equal(ToORNWei('50'));
    });

    it("User can stake, vote and unstake reminder", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
        await this.ogTestHelper.acceptNewLockAmount(ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        await this.orionGovernance.withdraw(ToORNWei('26'), { from: wallet2 }).should.not.be.fulfilled;
        await this.orionGovernance.withdraw(ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;
    });

    it("User can stake, vote and unstake reminder (differences)", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
        await this.ogTestHelper.acceptLock(ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        await this.orionGovernance.withdraw(ToORNWei('26'), { from: wallet2 }).should.not.be.fulfilled;
        await this.orionGovernance.withdraw(ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;
    });

    it("Stake and vote checks with differences", async function () {
        await this.orionGovernance.stake(ToORNWei('50'), { from: wallet2 }).should.be.fulfilled;
        await this.ogTestHelper.acceptLock(ToORNWei('26'), { from: wallet2 }).should.be.fulfilled;

        //  Try to lock more than staked
        await this.ogTestHelper.acceptLock(ToORNWei('26'), { from: wallet2 }).should.not.be.fulfilled;

        //  Try to lock equal to staking
        await this.ogTestHelper.acceptLock(ToORNWei('24'), { from: wallet2 }).should.be.fulfilled;

        //  Try to withdraw
        await this.ogTestHelper.acceptUnlock(ToORNWei('5'), { from: wallet2 }).should.be.fulfilled;
        await this.ogTestHelper.acceptUnlock(ToORNWei('46'), { from: wallet2 }).should.not.be.fulfilled;
        await this.ogTestHelper.acceptUnlock(ToORNWei('45'), { from: wallet2 }).should.be.fulfilled;

        //  Even 1 "wei" whould not be unlockable
        await this.ogTestHelper.acceptUnlock('1', { from: wallet2 }).should.not.be.fulfilled;
    });

    it("Two users staking", async function () {
        await this.orionGovernance.stake(ToORNWei('2'), { from: wallet2 }).should.be.fulfilled;
        await this.orionGovernance.stake(ToORNWei('3'), { from: wallet3 }).should.be.fulfilled;
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('5'));

        await this.orionGovernance.withdraw(ToORNWei('1'), { from: wallet3 }).should.be.fulfilled;
        (await this.orionGovernance.getBalance(wallet3)).toString().should.be.equal(ToORNWei('2'));
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('4'));

        await this.orionGovernance.withdraw(ToORNWei('1'), { from: wallet2 }).should.be.fulfilled;
        (await this.orionGovernance.getBalance(wallet2)).toString().should.be.equal(ToORNWei('1'));
        (await this.orionGovernance.getTotalBalance()).toString().should.be.equal(ToORNWei('3'));

    });

    it("Cannot stake more than user have", async function () {
        await this.orionGovernance.stake(ToORNWei('101'), { from: wallet2 }).should.not.be.fulfilled;
    });

    it("Check overflow ", async function () {
        //  Mint MANY tokens
        await this.orionToken.mint(wallet1, ToORNWei('10000000000'), { from: owner }).should.be.fulfilled;

        //  We remember that max uint56 ~7 x 10**16

        await this.orionGovernance.stake('70000000000000000', { from: wallet1 }).should.be.fulfilled;

        //  And here we overflow
        await this.orionGovernance.stake('70000000000000000', { from: wallet1 }).should.not.be.fulfilled;
    });
});

