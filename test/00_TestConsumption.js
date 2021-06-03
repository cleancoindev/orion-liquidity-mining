const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const Cons = artifacts.require('Test_GasConsumption');

contract('TestGasConsumption', function ([_, wallet1, wallet2, wallet3, wallet4]) {
    describe('TestGasConsumption', async function () {
        beforeEach(async function () {
            this.testGas = await Cons.new();

            //  Wallet 2 already has non-zero stores.
            await this.testGas.store1(wallet2, web3.utils.toWei('5'),web3.utils.toWei('5'), {from: wallet2}).should.be.fulfilled;
            await this.testGas.store2(wallet2, web3.utils.toWei('5'),web3.utils.toWei('5'), {from: wallet2}).should.be.fulfilled;
            await this.testGas.store3(wallet2, web3.utils.toWei('5'),web3.utils.toWei('5'), {from: wallet2}).should.be.fulfilled;
        });

        it("Consumption of cold store 1 ", async function () {
            await this.testGas.store1(wallet1, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of cold store 2 ", async function () {
            await this.testGas.store2(wallet1, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of cold store 3", async function () {
            await this.testGas.store3(wallet1, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        //  Warm store
        it("Consumption of warm store 1 ", async function () {
            await this.testGas.store1(wallet2, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of warm store 2 ", async function () {
            await this.testGas.store2(wallet2, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of warm store 3", async function () {
            await this.testGas.store3(wallet2, web3.utils.toWei('1'),web3.utils.toWei('1'), {from: wallet1}).should.be.fulfilled;
        });

        //  Reads
        it("Consumption of read warm store 1 ", async function () {
            await this.testGas.get1(wallet2, {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of read warm store 2 ", async function () {
            await this.testGas.get2(wallet2, {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of read warm store 3", async function () {
            await this.testGas.get3(wallet2, {from: wallet1}).should.be.fulfilled;
        });

        //  Reads (all)
        it("Consumption of read warm store ALL 1 ", async function () {
            await this.testGas.get1all(wallet2, {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of read warm store ALL 2 ", async function () {
            await this.testGas.get2all(wallet2, {from: wallet1}).should.be.fulfilled;
        });

        it("Consumption of read warm store ALL 3", async function () {
            await this.testGas.get3all(wallet2, {from: wallet1}).should.be.fulfilled;
        });

    });
});