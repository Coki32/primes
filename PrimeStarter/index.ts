import * as df from "durable-functions"
import { AzureFunction, Context, HttpRequest, HttpRequestQuery } from "@azure/functions"

interface Range {
    from: number;
    to: number;
    length: number;
};

function getRangesFromQuery(query: HttpRequestQuery): Range[] {
    let ranges: Range[] = [];
    let froms = query.from ? query.from.split(',').map(v => parseInt(v)) : null;
    let tos = query.to ? query.to.split(',').map(v => parseInt(v)) : null;
    if (!froms || !tos || froms.length !== tos.length)//ovo nije ok
        return [];

    return froms.map((f, idx) => ({ from: f, to: tos[idx], length: (tos[idx] - f) }));
}

//ovaj djavo je beskoristan, on samo pokrene orkestratora
const httpStart: AzureFunction = async function (context: Context, req: HttpRequest): Promise<any> {
    const client = df.getClient(context);
    //citav req.body se proslijedi orchestratoru
    let ranges = getRangesFromQuery(req.query);
    const runners = parseInt(req.body?.runners || req.body?.workers || req.query.runners || req.query.workers || 12);
    const instanceId = await client.startNew(req.params.functionName, undefined, { ranges, runners });

    context.log(`Started orchestration with ID = '${instanceId}'.`);

    return client.createCheckStatusResponse(context.bindingData.req, instanceId);
};

export default httpStart;
