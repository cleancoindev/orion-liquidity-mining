const { accounts, contract, web3, provide } = require('@openzeppelin/test-environment');
const { BN, expectRevert, time, constants, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ChainManipulation = require("./helpers/ChainManipulation");
const chai = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const OrionMigrator = contract.fromArtifact('OrionMigrator');
const IUniswapV2Pair = contract.fromArtifact("IUniswapV2Pair");

function ToORNWei(orn_val)
{
    let answ = new BN(orn_val);
    answ = answ.mul(new BN('10').pow(new BN('8')));
    return answ;
}

function ToWei(val)
{
    let answ = new BN(val);
    answ = answ.mul(new BN('10').pow(new BN('18')));
    return answ;
}

function isLess(a, b) {
    return Buffer.from(a.substring(2), 'hex').compare(Buffer.from(b.substring(2), 'hex')) <= 0;
}

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

describe('OrionStakingRewards', async function () {
    this.timeout(0);

    const [ owner, wallet1, wallet2, wallet3, wallet4 ] = accounts;
    let orn, weth;
    let factoryV1, routerV1, pairV1;
    let factoryV2, routerV2, pairV2;
    let uniswapStakingRewards, orionGovernance, orionVoting, orionStakingRewards;
    let migrator;

    async function setupTokens() {
        orn =  await contract.fromArtifact('TestORN').new(0, { from: owner });
        weth =  await contract.fromArtifact('WETH9').new(0, { from: owner });
    }

    async function setupPool() {
        const prevArtifactDir = contract.artifactsDir;
        contract.artifactsDir = "node_modules/@uniswap/v2-core/build";
        const UniswapV2Factory = contract.fromArtifact('UniswapV2Factory');
        factoryV1 = await UniswapV2Factory.new(owner, { from: owner });
        factoryV2 = await UniswapV2Factory.new(owner, { from: owner });

        await factoryV1.createPair(orn.address, weth.address, {from: owner});
        const res1 = await factoryV1.getPair(orn.address, weth.address);
        pairV1 = await IUniswapV2Pair.at(res1)

        await factoryV2.createPair(orn.address, weth.address, {from: owner});
        const res2 = await factoryV2.getPair(orn.address, weth.address);
        pairV2 = await IUniswapV2Pair.at(res2)

        contract.artifactsDir = "node_modules/@uniswap/v2-periphery/build";
        const UniswapV2Router02 = contract.fromArtifact('UniswapV2Router02');
        routerV1 = await UniswapV2Router02.new(factoryV1.address, weth.address);
        routerV2 = await UniswapV2Router02.new(factoryV2.address, weth.address);

        contract.artifactsDir = prevArtifactDir;
    }

    async function setupStakingRewards() {
        uniswapStakingRewards = await contract.fromArtifact('TestStakingRewards')
            .new(orn.address, pairV1.address, { from: owner });

        orionGovernance = await contract.fromArtifact('OrionGovernance').new({ from: owner });
        orionGovernance.initialize(orn.address, { from: owner });

        orionVoting = await contract.fromArtifact('OrionVoting').new({ from: owner });
        orionVoting.initialize(orn.address, orionGovernance.address, { from: owner });

        orionStakingRewards = await contract.fromArtifact('OrionStakingReward').new({ from: owner });
        orionStakingRewards.initialize( pairV2.address, orionVoting.address, { from: owner });

        await orionGovernance.setVotingContractAddress(orionVoting.address, {from: owner});
        await orionVoting.setPoolState(orionStakingRewards.address, 1+2+4, {from: owner});
    }
    async function addLiquidity(orn_val, eth_val, router, wallet) {
        await orn.mint(wallet, orn_val, {from: owner});
        await weth.deposit({from: wallet, value: eth_val});

        await orn.approve(router.address, orn_val, {from: wallet});
        await weth.approve(router.address, eth_val, {from: wallet});

        const result = await router.addLiquidity(orn.address, weth.address,
            orn_val, eth_val,
            orn_val, eth_val,
            wallet, "2000000000",
            {from: wallet}
        );

    }

    async function setupMigrator() {
        migrator = await contract.fromArtifact('OrionMigrator')
            .new(pairV1.address, routerV2.address, weth.address, orionStakingRewards.address, { from: owner });
    }

    beforeEach(async function () {
        await setupTokens();
        await setupPool();
        await setupStakingRewards()
        await setupMigrator();
    });

    it("Migrate equal price", async function () {
        await addLiquidity(ToORNWei('3000'), ToWei('10'), routerV1, wallet1);
        console.log("Wallet1 has LP1:", (await pairV1.balanceOf(wallet1)).toString());
        await addLiquidity(ToORNWei('3000'), ToWei('10'), routerV2, wallet1);
        console.log("Wallet1 has LP2:", (await pairV2.balanceOf(wallet1)).toString());

        await addLiquidity(ToORNWei('600'), ToWei('2'), routerV1, wallet2);
        const lpBalance1 = await pairV1.balanceOf(wallet2);
        console.log("Wallet2 has LP1:", lpBalance1.toString());

        await pairV1.approve(uniswapStakingRewards.address, lpBalance1, {from: wallet2});
        await uniswapStakingRewards.stake(lpBalance1,  {from: wallet2});
        const staked = await uniswapStakingRewards.balanceOf(wallet2);
        console.log("Wallet2 staked:", staked.toString());
        await uniswapStakingRewards.withdrawTo(staked, wallet2, {from: wallet2});

        await pairV1.approve(migrator.address, lpBalance1, {from: wallet2});
        const [min0, min1] = isLess(orn.address, weth.address) ? [ToORNWei('500'), ToWei('1')] : [ToWei('1'), ToORNWei('500')];
        const res = await migrator.migrate(lpBalance1, min0, min1, wallet2,  "2000000000", {from: wallet2});

        const arr = res.logs[0].args;
        const {amount0V1, amount1V1, amount0V2, amount1V2} = res.logs[0].args;
        console.log(amount0V1.toString(), amount1V1.toString(), amount0V2.toString(), amount1V2.toString());

        const lpBalance2 = await orionStakingRewards.balanceOf(wallet2);
        expect(await pairV1.balanceOf(wallet2)).bnEquals(new BN(0));
        console.log("Wallet2 has LP2:", lpBalance2.toString());
        expect(lpBalance2).bnEquals(lpBalance1);
    });

    it("Migrate to higher ORN price", async function () {
        await addLiquidity(ToORNWei('3000'), ToWei('10'), routerV1, wallet1);
        console.log("Wallet1 has LP1:", (await pairV1.balanceOf(wallet1)).toString());
        await addLiquidity(ToORNWei('2000'), ToWei('10'), routerV2, wallet1);
        const w1LP2 = await pairV2.balanceOf(wallet1);
        console.log("Wallet1 has LP2:", w1LP2.toString());

        await addLiquidity(ToORNWei('600'), ToWei('2'), routerV1, wallet2);
        const lpBalance1 = await pairV1.balanceOf(wallet2);
        console.log("Wallet2 has LP1:", lpBalance1.toString());

        await pairV1.approve(uniswapStakingRewards.address, lpBalance1, {from: wallet2});
        await uniswapStakingRewards.stake(lpBalance1,  {from: wallet2});
        const staked = await uniswapStakingRewards.balanceOf(wallet2);
        console.log("Wallet2 staked:", staked.toString());
        await uniswapStakingRewards.withdrawTo(staked, wallet2, {from: wallet2});

        await pairV1.approve(migrator.address, lpBalance1, {from: wallet2});
        const [min0, min1] = isLess(orn.address, weth.address) ?
            [ToORNWei('400').sub(new BN(1)), ToWei('2').sub(new BN(1))] :
            [ToWei('2').sub(new BN(1)), ToORNWei('400').sub(new BN(1))];
        const res = await migrator.migrate(lpBalance1, min0, min1, wallet2,  "2000000000", {from: wallet2});

        const arr = res.logs[0].args;
        const {amount0V1, amount1V1, amount0V2, amount1V2} = res.logs[0].args;
        console.log(amount0V1.toString(), amount1V1.toString(), amount0V2.toString(), amount1V2.toString());

        const lpBalance2 = await orionStakingRewards.balanceOf(wallet2);
        expect(await pairV1.balanceOf(wallet2)).bnEquals(new BN(0));
        console.log("Wallet2 has LP2:", lpBalance2.toString());
        // check that w1LP2/w2LP2 = w1ETH/w2ETH
        expect(lpBalance2).bnEquals(w1LP2.mul(ToWei('2')).div(ToWei('10')));

        // check remaining balance
        const remOrn = await orn.balanceOf(wallet2);
        console.log('Remaining ORN balance:', remOrn.toString());
        expect(remOrn).bnEquals(ToORNWei(200).sub(new BN(1)));
        expect(remOrn).to.be.bignumber.equal(ToORNWei(200));
    });

    it("Migrate to lower ORN price", async function () {
        await addLiquidity(ToORNWei('3000'), ToWei('10'), routerV1, wallet1);
        console.log("Wallet1 has LP1:", (await pairV1.balanceOf(wallet1)).toString());
        await addLiquidity(ToORNWei('6000'), ToWei('10'), routerV2, wallet1);
        const w1LP2 = await pairV2.balanceOf(wallet1);
        console.log("Wallet1 has LP2:", w1LP2.toString());

        await addLiquidity(ToORNWei('600'), ToWei('2'), routerV1, wallet2);
        const lpBalance1 = await pairV1.balanceOf(wallet2);
        console.log("Wallet2 has LP1:", lpBalance1.toString());

        await pairV1.approve(uniswapStakingRewards.address, lpBalance1, {from: wallet2});
        await uniswapStakingRewards.stake(lpBalance1,  {from: wallet2});
        const staked = await uniswapStakingRewards.balanceOf(wallet2);
        console.log("Wallet2 staked:", staked.toString());
        await uniswapStakingRewards.withdrawTo(staked, wallet2, {from: wallet2});

        const tracker = await balance.tracker(wallet2)

        await pairV1.approve(migrator.address, lpBalance1, {from: wallet2});
        const [min0, min1] = isLess(orn.address, weth.address) ?
            [ToORNWei(600).sub(new BN(1)), ToWei(1).sub(new BN(1e10))] :
            [ToWei(1).sub(new BN(1e10)), ToORNWei('600').sub(new BN(1))];
        const res = await migrator.migrate(lpBalance1, min0, min1, wallet2,  "2000000000", {from: wallet2});

        const arr = res.logs[0].args;
        const {amount0V1, amount1V1, amount0V2, amount1V2} = res.logs[0].args;
        console.log(amount0V1.toString(), amount1V1.toString(), amount0V2.toString(), amount1V2.toString());

        const lpBalance2 = await orionStakingRewards.balanceOf(wallet2);
        expect(await pairV1.balanceOf(wallet2)).bnEquals(new BN(0));
        console.log("Wallet2 has LP2:", lpBalance2.toString());
        // check that w1LP2/w2LP2 = w1ORN/w2ORN
        expect(lpBalance2).bnEquals(w1LP2.mul(ToORNWei('600')).div(ToORNWei('6000')));

        // check remaining balance
        const remWeth = await tracker.delta();
        console.log('Remaining ETH balance:', remWeth.toString());
        expect(remWeth).bnEquals(ToWei(1).sub(new BN(1)));
    });
});
