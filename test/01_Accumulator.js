const {BigNumber} = require("ethers/utils");
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

require("chai")
    .use(require("chai-shallow-deep-equal"))
    .use(require("chai-as-promised"))
    .should();

const OrionAccumulator = artifacts.require('Test_OrionAccumulatorHuge');

const _30Days = 24*3600*30;
async function timeIncreaseTo (seconds) {
    const delay = 10 - new Date().getMilliseconds();
    await new Promise(resolve => setTimeout(resolve, delay));
    await time.increaseTo(seconds);
}

contract('OrionAccumulator', function ([_, wallet1, wallet2, wallet3, wallet4]) {
    describe('OrionAccumulator', async function () {
        beforeEach(async function () {
            this.accTest = await OrionAccumulator.new();
        });

        it("Test empty accumulator", async function() {
            (await this.accTest.getAccCumulativeValue()).toString().should.be.equal('0');
        });

        it("Test base average (one change)", async function() {
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;
            let prev_acc_val = await this.accTest.getAccCumulativeValue();
            let prev_ts = await this.accTest.getAccTimestamp();

            let calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 2000);
            calculated_average.toString().should.be.equal('500');

            calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 1237243);
            calculated_average.toString().should.be.equal('500');

            //  ALso test from 0th second ???????????
            //  calculated_average = await this.accTest.calc(prev_acc_val, 0, 2000);
            //  calculated_average.toString().should.be.equal('500');
        });

        it("Test base average (3 changes in one time)", async function() {
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;
            let prev_acc_val = await this.accTest.getAccCumulativeValue();
            let prev_ts = await this.accTest.getAccTimestamp();

            //  Update at the same "time"
            await this.accTest.updateByActualValue(10000, 1000).should.be.fulfilled;
            //  And get back
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;

            let calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 2000);
            calculated_average.toString().should.be.equal('500');

            calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 1237243);
            calculated_average.toString().should.be.equal('500');

            //  ALso test from 0th second ???????????
            //  calculated_average = await this.accTest.calc(prev_acc_val, 0, 2000);
            //  calculated_average.toString().should.be.equal('500');
        });

        it("Test base average (two changes)", async function() {
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;
            let prev_acc_val = await this.accTest.getAccCumulativeValue();
            let prev_ts = await this.accTest.getAccTimestamp();

            await this.accTest.updateByActualValue(1000, 2000).should.be.fulfilled;

            //  The average on 3000-th second should be 750
            let calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 3000);
            calculated_average.toString().should.be.equal('750');

            //  At the VERY long period it should be almost equal to 1000.
            //      We get the period as 1000-times 1000
            calculated_average = await this.accTest.calc(prev_acc_val, prev_ts, 2000 + 1000 * 1000);
            calculated_average.toString().should.be.equal('999');
        });

        it("Test complex average (many intermediate changes)", async function() {
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;
            let prev_acc_val1000 = await this.accTest.getAccCumulativeValue();
            let prev_ts1000 = await this.accTest.getAccTimestamp();

            await this.accTest.updateByActualValue(1000, 2000).should.be.fulfilled;

            let prev_acc_val2000 = await this.accTest.getAccCumulativeValue();
            let prev_ts2000 = await this.accTest.getAccTimestamp();

            await this.accTest.updateByActualValue(2000, 3000).should.be.fulfilled;
            await this.accTest.updateByActualValue(1000, 4000).should.be.fulfilled;

            //  Average, taken on 1000-5000th second
            let avg_since_1000 = Math.round(
                (500 * 1000 + 1000 * 1000 + 2000 * 1000 + 1000 * 1000) / 4000
            ).toString();

            //  Average, taken on 2000-5000th second
            let avg_since_2000 = Math.round(
                (             1000 * 1000 + 2000 * 1000 + 1000 * 1000) / 3000
            ).toString();

            let calculated_average1000 = await this.accTest.calc(prev_acc_val1000, prev_ts1000, 5000);
            calculated_average1000.toString().should.be.equal(avg_since_1000);

            let calculated_average2000 = await this.accTest.calc(prev_acc_val2000, prev_ts2000, 5000);
            calculated_average2000.toString().should.be.equal(avg_since_2000);
        });

        it("Test precision (determined)", async function() {
            //  The points
            const points = [
                ['123456788', 924],
                ['100142857142857', 2049],
                ['99183839324', 15097],
                ['72737271717281', 25911],
            ];

            /*
            const points = [
                ['1000', 1000],
                ['2000', 2000],
                ['3000', 3000],
                ['4000', 4000],
            ];*/

            //  The saved acc values and timestamps
            let accumulated_values_history = [];

            //  The "accumulator" inside JS - starting from 0th element
            let accumulated1 = new BigNumber(0);
            let accumulated2 = new BigNumber(0);

            let multiplier = new BigNumber(10).pow(new BigNumber(8));


            for(let I = 0; I < points.length; ++I)
            {
                const entry = points[I];
                let cur_val_bn = new BigNumber(entry[0]).mul(multiplier);
                await this.accTest.updateByActualValue(cur_val_bn.toString(), entry[1]);

                accumulated_values_history.push(
                    [await this.accTest.getAccCumulativeValue(),
                        await this.accTest.getAccTimestamp()]
                );

                //  Add to accumulated only "prev" value
                if(I > 0)
                {
                    let prev_val_bn = new BigNumber(points[I-1][0]).mul(multiplier);
                    accumulated1 = accumulated1.add(prev_val_bn.mul(new BigNumber(entry[1] - points[I-1][1])));
                }

                if(I > 1)
                {
                    let prev_val_bn = new BigNumber(points[I-1][0]).mul(multiplier);
                    accumulated2 = accumulated2.add(prev_val_bn.mul(new BigNumber(entry[1] - points[I-1][1])));
                }
            }

            //  console.log(accumulated);
            //  Now we need to divide the
            let average_test1 = accumulated1.div(new BigNumber(points[points.length-1][1] - points[0][1]));

            let average_contract1 = await this.accTest.calc(
                accumulated_values_history[0][0],
                accumulated_values_history[0][1],
                points[points.length-1][1]
            );

            average_contract1.toString().should.be.equal(average_test1.toString());

            let average_test2 = accumulated2.div(new BigNumber(points[points.length-1][1] - points[1][1]));

            let average_contract2 = await this.accTest.calc(
                accumulated_values_history[1][0],
                accumulated_values_history[1][1],
                points[points.length-1][1]
            );

            average_contract2.toString().should.be.equal(average_test2.toString());

            console.log(average_contract1.toString());
            console.log(average_test1.toString());
            console.log(average_contract2.toString());
            console.log(average_test2.toString());

        });

        it("Test future", async function() {
            await this.accTest.updateByActualValue(500, 1000).should.be.fulfilled;
            let prev_acc_val = await this.accTest.getAccCumulativeValue();
            let prev_ts = await this.accTest.getAccTimestamp();

            //  test right at this second
            let calculated_average = await this.accTest.calc(prev_acc_val, 1000, 2000);
            calculated_average.toString().should.be.equal('500');

            calculated_average = await this.accTest.calc(prev_acc_val, 2000, 3000);
            calculated_average.toString().should.be.equal('500');

            calculated_average = await this.accTest.calc(prev_acc_val, 3000, 4000);
            calculated_average.toString().should.be.equal('500');
        });

    });
});