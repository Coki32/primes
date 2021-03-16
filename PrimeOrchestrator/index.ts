/*
 * This function is not intended to be invoked directly. Instead it will be
 * triggered by an HTTP starter function.
 * 
 * Before running this sample, please:
 * - create a Durable activity function (default name is "Hello")
 * - create a Durable HTTP starter function
 * - run 'npm install durable-functions' from the wwwroot folder of your 
 *    function app in Kudu
 */

import * as df from "durable-functions"

interface Range {
    from: number;
    to: number;
    length: number;
};

function getSegments(inclusiveStart: number, exclusiveEnd: number, runners: number): Array<Range> {
    let len = exclusiveEnd - inclusiveStart;
    let segmentLength = Math.ceil(len / runners);
    let result: Array<Range> = new Array<Range>();
    let l = inclusiveStart, h = inclusiveStart + segmentLength;
    for (let i = 0; i < runners; i++) {
        result.push({ from: l, to: h, length: h - l });
        l = h;
        h = Math.min(h + segmentLength, exclusiveEnd);
    }
    return result;
}


function mergeNeighbors(ranges: Range[]): Range[] {
    if(ranges.length===1)
        return ranges;//funkcija pojede ovaj jedan jedini ako ima samo jedan
    let fixed: Range[] = [];
    ranges.sort((a, b) => a.to < b.to ? -1 : 1);
    for (let i = 0; i < ranges.length && ranges.length !== 1; i++) {
        let subFrom = ranges[i].from, subTo = ranges[i].to;
        for (let j = 0; j < ranges.length;)
            if (ranges[j].from === subTo) {
                subTo = ranges[j].to;
                ranges.splice(j, 1);
            }
            else
                j++;
        fixed.push({ from: subFrom, to: subTo, length: subTo - subFrom });
    }
    return fixed;
}

function removeSubranges(ranges: Range[]): Range[] {
    let fixed: Range[] = [];
    let contains = (a: Range, b: Range) => a.from >= b.from && a.to <= b.to;
    for (let i = 0; i < ranges.length;) {
        if (ranges.some((target, idx) => idx !== i && contains(ranges[i], target)))//ako je ranges[i] PODOPSEG target-a
            ranges.splice(i, 1);
        else {
            fixed.push(ranges[i]);
            i++;
        }
    }
    return fixed;
}

function splitRanges(ranges: Range[], maxLength: number): Range[] {
    let fixed: Range[] = [];
    for (let i = 0; i < ranges.length; i++) {
        if (ranges[i].length <= maxLength)
            fixed.push(ranges[i])
        else {
            //ako je duzina tipa za 2 elementa preko MAX onda splita njega na pola,
            //ako je duzina nekoliko puta veca od MAX onda napravi vise malih 
            let cur = ranges[i];
            while (cur.length > maxLength) {
                let sizeFactor = cur.length/maxLength;
                if(sizeFactor===1){
                    fixed.push(cur);
                    break;
                }
                else if(sizeFactor>=2){//moze biti barem 2 opsega
                    fixed.push({from:cur.from, to:cur.from+maxLength, length:maxLength});
                    cur.from+=maxLength;
                    cur.length-=maxLength;
                }
                else {// znaci da je izmedju 1 i 2, to se onda splita u 2 jednaka
                    let splitPoint = Math.trunc((ranges[i].to + ranges[i].from) / 2);
                    fixed.push({ from: ranges[i].from, to: splitPoint, length: splitPoint - ranges[i].from });
                    fixed.push({ from: splitPoint, to: ranges[i].to, length: ranges[i].to - splitPoint });
                    break;
                }
            }
        }
    }
    return fixed;
}


const orchestrator = df.orchestrator(function* (context) {
    const activityName = "PrimeActivity";
    const { ranges, runners } = context.bindings.limits.input;

    if ((ranges as Range[]).length === 0)
        return { error: "Neispravan input, froms i tos nizovi moraju biti iste duzine" };

    let actualRanges = removeSubranges(mergeNeighbors(ranges as Range[]));
    let totalNumbers = actualRanges.map(ar => ar.length).reduce((sum, val) => sum + val, 0);
    let aproxPerRunner = Math.ceil(totalNumbers / runners);
    let maxSegmentSize = Math.ceil(aproxPerRunner / 2);//nijedan segment ne moze biti veci od pola maksimuma

    let finalRanges = splitRanges(actualRanges, maxSegmentSize);
    let partialResults: number[] = [];

    while(finalRanges.length>0){
        context.log(`===============Pokrecem jos jednu rundu workera!`);
        let gonnaGoNow = finalRanges.splice(0,runners);
        let subResults = yield context.df.Task.all(gonnaGoNow.map(range => context.df.callActivity(activityName,{lower:range.from,upper:range.to})));
        for(let i=0; i<subResults.length; i++)
            partialResults.push(...(subResults[i]));
    }

    return partialResults;
});

export default orchestrator;
