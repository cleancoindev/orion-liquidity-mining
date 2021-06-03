const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const ChainManipulation = require("./helpers/ChainManipulation");
const chai = require('chai');

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

function ToORNWei(orn_val)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN('8')));
    return answ.toString();
}
async function ShiftTime(add_seconds)
{
    await ChainManipulation.advanceTime(add_seconds);
    await ChainManipulation.advanceBlock();
}

//  Precision = 0.1%
chai.Assertion.addMethod('bnEqualsPrecise', function (type) {
    //  var obj = this._obj;

    //  new chai.Assertion(this._obj).to.be.instanceof(BN); // OKk
    //  new chai.Assertion(typeof this._obj.toString()).to.be.a('string'); // OK

    var b = new BN(type);
    var a = new BN(this._obj);

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
            ratio.gt(new BN('999000000000')) && ratio.lt(new BN('1001000000000'))
        ).eql(true, a.toString() + " should be almost equal to " + b.toString());
    }
});

//  Precision = 1%
chai.Assertion.addMethod('bnEquals', function (type) {
    //  var obj = this._obj;

    //  new chai.Assertion(this._obj).to.be.instanceof(BN); // OKk
    //  new chai.Assertion(typeof this._obj.toString()).to.be.a('string'); // OK

    var b = new BN(type);
    var a = new BN(this._obj);

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

function ToBN(doubleVal, digits)
{
    const multiplier = 1e9;
    let nom = new BN(Math.round(doubleVal * multiplier).toString()).mul( new BN('10').pow(new BN(digits)) );
    let dv = new BN(multiplier);
    return nom.div(dv);
}

describe('OrionGovernanceWithRewards', async function () {
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

        //  We send some enough amount of orion to governance
        await this.orionToken.mint(owner, ToORNWei('1000000'), { from: owner });
        await this.orionToken.transfer(this.orionGovernance.address, ToORNWei('1000000'), { from: owner });
    });

    it("Only owner can set rewards", async function () {
        await this.orionGovernance.notifyRewardAmount(ToORNWei(100), 86400*7, 0, {from: owner}).should.be.fulfilled;
        await this.orionGovernance.notifyRewardAmount(ToORNWei(100), 86400*7, 0, {from: wallet1}).should.not.be.fulfilled;
    });

    it("Check rewards for staking (1 user, 1/2 period)", async function () {
        const period = 100000;
        const reward = 100;

        //  1000 ORN in 100000 (100k) seconds
        await this.orionGovernance.notifyRewardAmount(ToORNWei(reward), period, 0, {from: owner}).should.be.fulfilled;

        //  Stake (one and only user).
        //      No matter how much he will stake
        await this.orionGovernance.stake(ToORNWei('1'), { from: wallet1 });

        //  Get balance BEFORE time shifting and getting rewards
        let orn_before = await this.orionToken.balanceOf(wallet1);

        //  Shift for 1/2 of period
        await ShiftTime(period / 2);

        //  Get our rewards
        let tx_receipt = await this.orionGovernance.getReward({from: wallet1}).should.be.fulfilled;
        let orn_after = await this.orionToken.balanceOf(wallet1);

        //  The difference should be almost equal to reward / 2
        (orn_after.sub(orn_before)).should.bnEqualsPrecise(new BN(ToORNWei(reward / 2)));
    });

    it("Check rewards for staking (1 user, 3/2 period)", async function () {
        const period = 100000;
        const reward = 100;

        //  1000 ORN in 100000 (100k) seconds
        await this.orionGovernance.notifyRewardAmount(ToORNWei(reward), period, 0, {from: owner}).should.be.fulfilled;

        //  Stake (one and only user).
        //      No matter how much he will stake
        await this.orionGovernance.stake(ToORNWei('1'), { from: wallet1 });

        //  Get balance BEFORE time shifting and getting rewards
        let orn_before = await this.orionToken.balanceOf(wallet1);

        //  Shift for 3/2 of period
        await ShiftTime(period + period / 2);

        //  Get our rewards
        await this.orionGovernance.getReward({from: wallet1}).should.be.fulfilled;
        let orn_after = await this.orionToken.balanceOf(wallet1);

        //  The difference should be almost equal to reward / 2
        (orn_after.sub(orn_before)).should.bnEqualsPrecise(new BN(ToORNWei(reward)));

        //  Shift also for period
        await ShiftTime(period);
        await this.orionGovernance.getReward({from: wallet1}).should.be.fulfilled;

        let orn_after2 = await this.orionToken.balanceOf(wallet1);

        //  The difference should be almost equal to reward / 2
        (orn_after2.sub(orn_after).toString()).should.be.equal('0');

    });
});

