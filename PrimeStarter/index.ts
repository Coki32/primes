import * as df from "durable-functions"
import { AzureFunction, Context, HttpRequest, HttpRequestQuery } from "@azure/functions"

interface Range {
    from: number;
    to: number;
    length: number;
};

function getRangesFromQuery(query: HttpRequestQuery): Range[] {
    let froms = query.from ? query.from.split(',').map(v => parseInt(v)) : null;
    let tos = query.to ? query.to.split(',').map(v => parseInt(v)) : null;
    if (!froms || !tos || froms.length !== tos.length)//ovo nije ok
        return [];
    return froms.map((f, idx) => ({ from: f, to: tos[idx], length: (tos[idx] - f) }));
}

function getRangesFromBody(body: any): Range[] {
    let ranges: Range[] = [];
    if (!(body.froms && body.tos && Array.isArray(body.froms) && Array.isArray(body.tos) && body.froms.length === body.tos.length))
        return [];
    let froms = (body.froms as []).map(v=>parseInt(v));//za svaki slucaj ako neki specijalac posalje string...
    let tos = (body.tos as []).map(v=>parseInt(v));
    return (froms as number[]).map((from,idx)=>({from:from, to: tos[idx], length:(tos[idx]-from)}));

}

//ovaj djavo je beskoristan, on samo pokrene orkestratora
const httpStart: AzureFunction = async function (context: Context, req: HttpRequest): Promise<any> {
    const client = df.getClient(context);
    let ranges: Range[] = [];
    if (req.method === 'GET')
        ranges = getRangesFromQuery(req.query);
    else if (req.method === 'POST')
        ranges = getRangesFromBody(req.body);

    const runners = parseInt(req.body?.runners || req.body?.workers || req.query.runners || req.query.workers || 12);
    const instanceId = await client.startNew(req.params.functionName, undefined, { ranges, runners });

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    return client.createCheckStatusResponse(context.bindingData.req, instanceId);
};

export default httpStart;


/**
 * Onaj pravi je na adresi:
 * https://prostaci.azurewebsites.net/api/orchestrators/PrimeOrchestrator?from=0&to=20000&runners=20&from=15&to=24&from=34&to=123&from=24&to=31&from=31&to=34&from=20010&to=201500
 *srecno...
 */