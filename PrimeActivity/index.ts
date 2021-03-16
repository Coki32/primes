import { AzureFunction, Context } from "@azure/functions"

function isPrime(n: number): boolean {
    if (n <= 1)
        return false;//lol
    let limit = Math.floor(Math.sqrt(n));
    for (let i = 2; i <= limit; i++)
        if (n % i === 0)
            return false;
    return true;
}

function primesInSegment(lower: number, upper: number): number[] {
    let result: number[] = [];
    for (let n = lower; n < upper; n++)
        if (isPrime(n))//cast, bice number, nece biti void
            result.push(n);
    return result;
}

//ova vraca pravi
const activityFunction: AzureFunction = async function (context: Context): Promise<Array<number>> {
    const { lower, upper } = context.bindings.bounds;
    let what = primesInSegment(lower, upper);
    context.log(`================== POKRENUT WORKER ZA ${lower} ${upper} ima ih ${ what.length }`)
    return what;
};

export default activityFunction;
